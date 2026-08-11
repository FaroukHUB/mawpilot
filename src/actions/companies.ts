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

  await logActivity(supabase, user.id, {
    actionType: "entreprise_creee",
    description: `Entreprise « ${data.name} » créée.`,
    companyId: data.id,
    after: parsed.data,
  });

  revalidatePath("/entreprises");
  return { data };
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
