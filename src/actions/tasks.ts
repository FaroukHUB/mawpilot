"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validations/tasks";
import { taskStatusLabels } from "@/lib/labels";
import type { TaskStatus } from "@/lib/enums";
import type { Task } from "@/types/database";
import type { ActionResult } from "@/actions/companies";

function revalidateTaskPaths(companyId: string) {
  revalidatePath("/taches");
  revalidatePath("/dashboard");
  revalidatePath(`/entreprises/${companyId}`);
}

export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = taskSchema.safeParse(input);
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

  if (parsed.data.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", parsed.data.project_id)
      .eq("company_id", company.id)
      .eq("user_id", user.id)
      .single();
    if (!project) return { error: "Projet introuvable pour cette entreprise." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, user_id: user.id, source: "manuelle" })
    .select()
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "tache_creee",
    description: `Tâche « ${data.title} » créée pour ${company.name}.`,
    companyId: company.id,
    projectId: data.project_id,
    taskId: data.id,
    after: parsed.data,
  });

  revalidateTaskPaths(company.id);
  return { data };
}

export async function updateTask(
  id: string,
  input: unknown
): Promise<ActionResult<Task>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: before } = await supabase
    .from("tasks")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!before) return { error: "Tâche introuvable." };

  const completedAt =
    parsed.data.status === "terminee"
      ? (before.completed_at ?? new Date().toISOString())
      : null;

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...parsed.data, completed_at: completedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: "Modification impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "tache_modifiee",
    description: `Tâche « ${data.title} » modifiée.`,
    companyId: data.company_id,
    projectId: data.project_id,
    taskId: data.id,
    before,
    after: parsed.data,
  });

  revalidateTaskPaths(data.company_id);
  return { data };
}

/** Changement de statut rapide (terminer, reprendre, bloquer…). */
export async function setTaskStatus(
  id: string,
  status: TaskStatus
): Promise<ActionResult<Task>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: before } = await supabase
    .from("tasks")
    .select()
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!before) return { error: "Tâche introuvable." };

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at:
        status === "terminee" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return { error: "Changement de statut impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType:
      status === "terminee" ? "tache_terminee" : "tache_statut_change",
    description:
      status === "terminee"
        ? `Tâche « ${data.title} » terminée.`
        : `Tâche « ${data.title} » passée à « ${taskStatusLabels[status]} ».`,
    companyId: data.company_id,
    projectId: data.project_id,
    taskId: data.id,
    before: { status: before.status },
    after: { status },
  });

  revalidateTaskPaths(data.company_id);
  return { data };
}
