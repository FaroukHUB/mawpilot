import type { SupabaseClient } from "@supabase/supabase-js";

type LogEntry = {
  actionType: string;
  description: string;
  companyId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  before?: unknown;
  after?: unknown;
  source?: "manuelle" | "ia";
};

/**
 * Journalise une action dans activity_logs (historique immuable).
 * Un échec de journalisation ne doit pas faire échouer l'action métier :
 * l'erreur est signalée en console serveur uniquement.
 */
export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  entry: LogEntry
): Promise<void> {
  const { error } = await supabase.from("activity_logs").insert({
    user_id: userId,
    company_id: entry.companyId ?? null,
    project_id: entry.projectId ?? null,
    task_id: entry.taskId ?? null,
    action_type: entry.actionType,
    description: entry.description,
    before_data: entry.before ?? null,
    after_data: entry.after ?? null,
    source: entry.source ?? "manuelle",
  });

  if (error) {
    console.error("Échec de journalisation :", error.message);
  }
}
