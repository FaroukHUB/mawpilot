"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

/**
 * Gestion des accès clients.
 *
 * L'application crée elle-même le compte Supabase : il n'y a rien à faire
 * dans le tableau de bord Supabase. C'est toujours vous qui donnez l'accès —
 * aucune inscription libre n'existe.
 */

const accountSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  display_name: z.string().trim().min(1, "Indiquez un nom.").max(200),
  /** Vide = mot de passe généré automatiquement. */
  password: z.string().max(200).optional(),
  contact_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .nullable()
    .optional(),
});

/** Mot de passe lisible mais solide, à transmettre au client. */
function generatePassword(): string {
  const words = [
    "atelier", "boussole", "cabane", "dauphin", "epaule", "falaise",
    "gravier", "horizon", "jardin", "lanterne", "marbre", "nuage",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick()}-${pick()}-${digits}`;
}

/**
 * Traduit les pannes de configuration en messages exploitables, plutôt que
 * de laisser remonter une erreur technique incompréhensible.
 */
function describeSetupError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return (
      "Configuration incomplète : la variable SUPABASE_SERVICE_ROLE_KEY est absente. " +
      "Ajoutez-la dans Vercel (Settings → Environment Variables), depuis " +
      "Supabase → Settings → API → clé service_role, puis redéployez."
    );
  }
  if (
    message.includes("client_users") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return (
      "La table des accès clients n'existe pas encore : appliquez la migration 13 " +
      "dans Supabase → SQL Editor, puis réessayez."
    );
  }
  return null;
}

export type AccountResult = {
  id: string;
  email: string;
  /** Renseigné uniquement à la création : à transmettre au client. */
  password: string | null;
  created: boolean;
};

/**
 * Crée le compte du client s'il n'existe pas, puis le rattache à l'entreprise.
 * Si le compte existe déjà, il est simplement rattaché.
 */
export async function createClientAccount(
  input: unknown
): Promise<ActionResult<AccountResult>> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", parsed.data.company_id)
    .eq("user_id", user.id)
    .single();
  if (!company) return { error: "Entreprise introuvable." };

  try {
    const admin = createAdminClient();
    const email = parsed.data.email;

    // Le compte existe-t-il déjà ?
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return { error: "Impossible de vérifier les comptes : " + listError.message };
    }

    const existing = list.users.find(
      (candidate) => candidate.email?.toLowerCase() === email
    );

    if (existing?.id === user.id) {
      return {
        error: "C'est votre propre compte : il ne peut pas devenir un accès client.",
      };
    }

    let authUserId: string;
    let password: string | null = null;
    let created = false;

    if (existing) {
      authUserId = existing.id;
    } else {
      password = parsed.data.password?.trim() || generatePassword();
      if (password.length < 8) {
        return { error: "Le mot de passe doit contenir au moins 8 caractères." };
      }

      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          // Pas d'email de confirmation : c'est vous qui transmettez l'accès.
          email_confirm: true,
          user_metadata: { full_name: parsed.data.display_name, role: "client" },
        });

      if (createError || !newUser.user) {
        return {
          error: "Création du compte impossible : " + (createError?.message ?? ""),
        };
      }
      authUserId = newUser.user.id;
      created = true;
    }

    const { data, error } = await admin
      .from("client_users")
      .upsert(
        {
          auth_user_id: authUserId,
          owner_user_id: user.id,
          company_id: company.id,
          contact_id: parsed.data.contact_id ?? null,
          display_name: parsed.data.display_name,
          is_active: true,
        },
        { onConflict: "auth_user_id" }
      )
      .select("id")
      .single();

    if (error) {
      const setup = describeSetupError(error);
      return { error: setup ?? "Rattachement impossible : " + error.message };
    }

    await logActivity(supabase, user.id, {
      actionType: "acces_client_cree",
      description: `Accès client « ${parsed.data.display_name} » (${email}) activé pour ${company.name}.`,
      companyId: company.id,
    });

    revalidatePath(`/entreprises/${company.id}`);
    return { data: { id: data.id, email, password, created } };
  } catch (error) {
    const setup = describeSetupError(error);
    if (setup) return { error: setup };
    console.error("Création d'accès client :", error);
    return {
      error:
        "Création impossible. Vérifiez que la migration 13 est appliquée et que " +
        "SUPABASE_SERVICE_ROLE_KEY est configurée chez votre hébergeur.",
    };
  }
}

/** Réinitialise le mot de passe d'un accès client. */
export async function resetClientPassword(
  clientUserId: string
): Promise<ActionResult<{ password: string; email: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: account } = await supabase
    .from("client_users")
    .select("id, auth_user_id, display_name, company_id")
    .eq("id", clientUserId)
    .eq("owner_user_id", user.id)
    .single();
  if (!account) return { error: "Accès introuvable." };

  try {
    const admin = createAdminClient();
    const password = generatePassword();

    const { data: updated, error } = await admin.auth.admin.updateUserById(
      account.auth_user_id,
      { password }
    );
    if (error) {
      return { error: "Réinitialisation impossible : " + error.message };
    }

    await logActivity(supabase, user.id, {
      actionType: "acces_client_mot_de_passe",
      description: `Mot de passe réinitialisé pour « ${account.display_name} ».`,
      companyId: account.company_id,
    });

    revalidatePath(`/entreprises/${account.company_id}`);
    return {
      data: { password, email: updated.user?.email ?? account.display_name },
    };
  } catch (error) {
    const setup = describeSetupError(error);
    return { error: setup ?? "Réinitialisation impossible." };
  }
}

export async function setClientAccountActive(
  clientUserId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("client_users")
    .update({ is_active: isActive })
    .eq("id", clientUserId)
    .eq("owner_user_id", user.id)
    .select("id, company_id, display_name")
    .single();

  if (error || !data) return { error: "Accès introuvable." };

  await logActivity(supabase, user.id, {
    actionType: isActive ? "acces_client_reactive" : "acces_client_suspendu",
    description: `Accès client « ${data.display_name} » ${isActive ? "réactivé" : "suspendu"}.`,
    companyId: data.company_id,
  });

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

/** Diagnostic affiché dans l'interface quand quelque chose manque. */
export async function checkClientAccessSetup(): Promise<{
  serviceRoleKey: boolean;
  tableReady: boolean;
  message: string | null;
}> {
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasKey) {
    return {
      serviceRoleKey: false,
      tableReady: false,
      message:
        "Variable SUPABASE_SERVICE_ROLE_KEY absente : ajoutez-la chez votre hébergeur (Supabase → Settings → API → service_role), puis redéployez.",
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("client_users")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return {
        serviceRoleKey: true,
        tableReady: false,
        message:
          "La table des accès clients est introuvable : appliquez la migration 13 dans Supabase → SQL Editor.",
      };
    }
    return { serviceRoleKey: true, tableReady: true, message: null };
  } catch {
    return {
      serviceRoleKey: true,
      tableReady: false,
      message: "Vérification impossible. Réessayez après un redéploiement.",
    };
  }
}
