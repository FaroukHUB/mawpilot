import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FactDocument,
  FactTask,
  FactTimeEntry,
  ReportFacts,
  ReportPeriod,
} from "@/lib/reports/types";

/**
 * Assemblage des faits d'un rapport.
 *
 * Cette fonction est volontairement PURE et déterministe : mêmes entrées,
 * même sortie. Elle ne produit jamais un fait qui n'existe pas dans les
 * données. C'est elle qui est testée unitairement.
 */

type RawTask = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  billing_status: string;
  amount: number | null;
  due_date: string | null;
  completed_at: string | null;
  updated_at: string;
  projects: { name: string } | null;
};

type RawTimeEntry = {
  id: string;
  entry_date: string;
  minutes: number;
  description: string | null;
  is_billable: boolean;
  task_id: string | null;
  tasks: { title: string } | null;
};

type RawDocument = {
  id: string;
  name: string;
  type: string;
  external_url: string | null;
  created_at: string;
};

/** Vrai si l'horodatage tombe dans la période (bornes incluses, dates locales). */
function isWithin(period: ReportPeriod, isoDate: string | null): boolean {
  if (!isoDate) return false;
  const day = isoDate.slice(0, 10);
  return day >= period.start && day <= period.end;
}

function toFactTask(task: RawTask, minutesByTask: Map<string, number>): FactTask {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    priority: task.priority,
    status: task.status,
    billing_status: task.billing_status,
    amount: task.amount,
    due_date: task.due_date,
    completed_at: task.completed_at,
    project_name: task.projects?.name ?? null,
    minutes: minutesByTask.get(task.id) ?? 0,
  };
}

export function buildReportFacts(input: {
  companyName: string;
  period: ReportPeriod;
  tasks: RawTask[];
  timeEntries: RawTimeEntry[];
  documents: RawDocument[];
}): ReportFacts {
  const { companyName, period, tasks, timeEntries, documents } = input;

  // Temps de la période, agrégé par tâche.
  const periodEntries = timeEntries.filter((e) => isWithin(period, e.entry_date));
  const minutesByTask = new Map<string, number>();
  for (const entry of periodEntries) {
    if (!entry.task_id) continue;
    minutesByTask.set(
      entry.task_id,
      (minutesByTask.get(entry.task_id) ?? 0) + entry.minutes
    );
  }

  const completedTasks = tasks
    .filter((t) => t.status === "terminee" && isWithin(period, t.completed_at))
    .map((t) => toFactTask(t, minutesByTask));

  const inProgressTasks = tasks
    .filter((t) => t.status === "en_cours")
    .map((t) => toFactTask(t, minutesByTask));

  const blockedTasks = tasks
    .filter((t) => t.status === "bloquee")
    .map((t) => toFactTask(t, minutesByTask));

  const waitingClientTasks = tasks
    .filter((t) => t.status === "en_attente_client")
    .map((t) => toFactTask(t, minutesByTask));

  // Échéances à venir : après la fin de période, tâches non terminées.
  const upcomingTasks = tasks
    .filter(
      (t) =>
        t.status !== "terminee" &&
        t.status !== "archivee" &&
        t.due_date !== null &&
        t.due_date > period.end
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 10)
    .map((t) => toFactTask(t, minutesByTask));

  // Prestations à facturer : statut « à facturer » ou « supplémentaire ».
  const unbilledTasks = tasks
    .filter(
      (t) =>
        t.billing_status === "a_facturer" || t.billing_status === "supplementaire"
    )
    .map((t) => toFactTask(t, minutesByTask));

  const factTimeEntries: FactTimeEntry[] = periodEntries.map((e) => ({
    id: e.id,
    entry_date: e.entry_date,
    minutes: e.minutes,
    description: e.description,
    is_billable: e.is_billable,
    task_title: e.tasks?.title ?? null,
  }));

  const factDocuments: FactDocument[] = documents
    .filter((d) => isWithin(period, d.created_at))
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      external_url: d.external_url,
      created_at: d.created_at,
    }));

  const totalMinutes = periodEntries.reduce((s, e) => s + e.minutes, 0);
  const billableMinutes = periodEntries
    .filter((e) => e.is_billable)
    .reduce((s, e) => s + e.minutes, 0);
  const unbilledAmount = unbilledTasks.reduce((s, t) => s + (t.amount ?? 0), 0);

  return {
    period,
    companyName,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    waitingClientTasks,
    upcomingTasks,
    unbilledTasks,
    timeEntries: factTimeEntries,
    documents: factDocuments,
    totals: {
      completedCount: completedTasks.length,
      totalMinutes,
      billableMinutes,
      unbilledAmount,
    },
  };
}

/**
 * Récupère les données brutes puis délègue l'assemblage à `buildReportFacts`.
 * Vérifie systématiquement l'appartenance à l'utilisateur.
 */
export async function fetchReportFacts(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  companyName: string,
  period: ReportPeriod
): Promise<ReportFacts> {
  const [{ data: tasks }, { data: timeEntries }, { data: documents }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, category, priority, status, billing_status, amount, due_date, completed_at, updated_at, projects(name)"
        )
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .neq("status", "archivee"),
      supabase
        .from("time_entries")
        .select(
          "id, entry_date, minutes, description, is_billable, task_id, tasks(title)"
        )
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .gte("entry_date", period.start)
        .lte("entry_date", period.end),
      supabase
        .from("company_documents")
        .select("id, name, type, external_url, created_at")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .eq("status", "actif"),
    ]);

  return buildReportFacts({
    companyName,
    period,
    tasks: (tasks ?? []) as unknown as RawTask[],
    timeEntries: (timeEntries ?? []) as unknown as RawTimeEntry[],
    documents: (documents ?? []) as RawDocument[],
  });
}
