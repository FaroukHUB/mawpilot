"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

/**
 * Rattache un compte Supabase existant à une entreprise.
 *
 * Il n'y a pas d'inscription : vous créez le compte dans
 * Authentication → Users, puis vous le reliez ici à l'entreprise. Le client
 * se connecte alors sur la page de connexion habituelle et arrive
 * directement dans son espace.
 */

const linkSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  email: z.string().trim().email("Adresse email invalide."),
  display_name: z.string().trim().min(1, "Indiquez un nom.").max(200),
  contact_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .nullable()
    .optional(),
});

export async function linkClientAccount(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = linkSchema.safeParse(input);
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

  // Recherche du compte déjà créé dans Supabase.
  const admin = createAdminClient();
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return { error: "Impossible de vérifier le compte : " + listError.message };
  }

  const target = list.users.find(
    (candidate) =>
      candidate.email?.toLowerCase() === parsed.data.email.toLowerCase()
  );

  if (!target) {
    return {
      error:
        "Aucun compte avec cet email. Créez-le d'abord dans Supabase → Authentication → Users, puis réessayez.",
    };
  }

  if (target.id === user.id) {
    return {
      error:
        "C'est votre propre compte : il ne peut pas devenir un accès client.",
    };
  }

  const { data, error } = await admin
    .from("client_users")
    .upsert(
      {
        auth_user_id: target.id,
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

  if (error) return { error: "Rattachement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "acces_client_cree",
    description: `Accès client « ${parsed.data.display_name} » (${parsed.data.email}) activé pour ${company.name}.`,
    companyId: company.id,
  });

  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
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
