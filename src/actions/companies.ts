"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validations/companies";
import type { Company } from "@/types/database";

export type ActionResult<T = undefined> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null } as const;
  return { supabase, user } as const;
}

export async function createCompany(
  input: unknown
): Promise<ActionResult<Company>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  // Cohérence des données : un contact saisi ici doit exister comme vrai
  // contact, et le site comme accès rapide — sinon les onglets restent vides
  // alors que l'information a bien été donnée.
  await syncCompanyRelatedRecords(supabase, user.id, data);

  await logActivity(supabase, user.id, {
    actionType: "entreprise_creee",
    description: `Entreprise « ${data.name} » créée.`,
    companyId: data.id,
    after: parsed.data,
  });

  revalidatePath("/entreprises");
  revalidatePath(`/entreprises/${data.id}`);
  return { data };
}

/**
 * Crée le contact principal et l'accès rapide du site s'ils n'existent pas
 * déjà. Idempotent : ne crée jamais de doublon, ne modifie rien d'existant.
 */
async function syncCompanyRelatedRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  company: Company
): Promise<void> {
  if (company.contact_name) {
    const { data: existing } = await supabase
      .from("company_contacts")
      .select("id")
      .eq("company_id", company.id)
      .eq("user_id", userId)
      .ilike("name", company.contact_name)
      .maybeSingle();

    if (!existing) {
      await supabase.from("company_contacts").insert({
        user_id: userId,
        company_id: company.id,
        name: company.contact_name,
        email: company.contact_email,
        phone: company.contact_phone,
        role: "Contact principal",
      });
    }
  }

  if (company.website) {
    const { data: existing } = await supabase
      .from("company_resources")
      .select("id")
      .eq("company_id", company.id)
      .eq("user_id", userId)
      .eq("url", company.website)
      .maybeSingle();

    if (!existing) {
      await supabase.from("company_resources").insert({
        user_id: userId,
        company_id: company.id,
        category: "site_public",
        label: `Site — ${company.name}`,
        url: company.website,
        is_favorite: true,
      });
    }
  }
}

/**
 * Rattrape les entreprises créées avant cette règle : contacts et sites
 * renseignés sur la fiche mais absents de leurs onglets.
 */
export async function syncAllCompaniesConsistency(): Promise<
  ActionResult<{ contacts: number; resources: number }>
> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: companies } = await supabase
    .from("companies")
    .select()
    .eq("user_id", user.id);

  let contacts = 0;
  let resources = 0;

  for (const company of (companies ?? []) as Company[]) {
    const before = await Promise.all([
      supabase
        .from("company_contacts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
      supabase
        .from("company_resources")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
    ]);

    await syncCompanyRelatedRecords(supabase, user.id, company);

    const after = await Promise.all([
      supabase
        .from("company_contacts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
      supabase
        .from("company_resources")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id),
    ]);

    contacts += (after[0].count ?? 0) - (before[0].count ?? 0);
    resources += (after[1].count ?? 0) - (before[1].count ?? 0);
  }

  revalidatePath("/entreprises");
  return { data: { contacts, resources } };
}

export async function updateCompany(
  id: string,
  input: unknown
): Promise<ActionResult<Company>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: before } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!before) return { error: "Entreprise introuvable." };

  const { data, error } = await supabase
    .from("companies")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: "Modification impossible : " + error.message };

  // Un contact ou un site ajouté après coup doit aussi apparaître dans son
  // onglet. Rien n'est écrasé : la synchronisation est purement additive.
  await syncCompanyRelatedRecords(supabase, user.id, data);

  await logActivity(supabase, user.id, {
    actionType: "entreprise_modifiee",
    description: `Entreprise « ${data.name} » modifiée.`,
    companyId: data.id,
    before,
    after: parsed.data,
  });

  revalidatePath("/entreprises");
  revalidatePath(`/entreprises/${id}`);
  return { data };
}

/** Archive (ou réactive) une entreprise — jamais de suppression par défaut. */
export async function setCompanyActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<Company>> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("companies")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) return { error: "Entreprise introuvable." };

  await logActivity(supabase, user.id, {
    actionType: isActive ? "entreprise_reactivee" : "entreprise_archivee",
    description: `Entreprise « ${data.name} » ${isActive ? "réactivée" : "archivée"}.`,
    companyId: data.id,
  });

  revalidatePath("/entreprises");
  revalidatePath(`/entreprises/${id}`);
  return { data };
}
