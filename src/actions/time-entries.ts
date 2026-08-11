"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { formatMinutes } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { timeEntrySchema } from "@/lib/validations/time-entries";
import type { ActionResult } from "@/actions/companies";

/**
 * Enregistre du temps passé, rattaché à une entreprise et éventuellement
 * à une tâche. Met à jour le temps réel cumulé de la tâche.
 */
export async function logTime(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = timeEntrySchema.safeParse(input);
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

  let taskTitle: string | null = null;
  if (parsed.data.task_id) {
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", parsed.data.task_id)
      .eq("company_id", company.id)
      .eq("user_id", user.id)
      .single();
    if (!task) return { error: "Tâche introuvable pour cette entreprise." };
    taskTitle = task.title;
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();

  if (error) return { error: "Enregistrement impossible : " + error.message };

  // Recalcule le temps réel cumulé de la tâche.
  if (parsed.data.task_id) {
    const { data: entries } = await supabase
      .from("time_entries")
      .select("minutes")
      .eq("task_id", parsed.data.task_id);
    const total = (entries ?? []).reduce((sum, e) => sum + e.minutes, 0);
    await supabase
      .from("tasks")
      .update({ actual_minutes: total })
      .eq("id", parsed.data.task_id)
      .eq("user_id", user.id);
  }

  await logActivity(supabase, user.id, {
    actionType: "temps_enregistre",
    description: taskTitle
      ? `${formatMinutes(parsed.data.minutes)} enregistrées sur « ${taskTitle} » (${company.name}).`
      : `${formatMinutes(parsed.data.minutes)} enregistrées pour ${company.name}.`,
    companyId: company.id,
    taskId: parsed.data.task_id ?? null,
    after: parsed.data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/taches");
  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}
