"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { projectSchema } from "@/lib/validations/projects";
import type { Project } from "@/types/database";
import type { ActionResult } from "@/actions/companies";

export async function createProject(
  input: unknown
): Promise<ActionResult<Project>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  // Vérifie que l'entreprise appartient bien à l'utilisateur.
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", parsed.data.company_id)
    .eq("user_id", user.id)
    .single();
  if (!company) return { error: "Entreprise introuvable." };

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "projet_cree",
    description: `Projet « ${data.name} » créé pour ${company.name}.`,
    companyId: company.id,
    projectId: data.id,
    after: parsed.data,
  });

  revalidatePath(`/entreprises/${company.id}`);
  return { data };
}

export async function updateProject(
  id: string,
  input: unknown
): Promise<ActionResult<Project>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: before } = await supabase
    .from("projects")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!before) return { error: "Projet introuvable." };

  const { data, error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: "Modification impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "projet_modifie",
    description: `Projet « ${data.name} » modifié.`,
    companyId: data.company_id,
    projectId: data.id,
    before,
    after: parsed.data,
  });

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data };
}
