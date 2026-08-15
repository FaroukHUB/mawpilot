import "server-only";

import { formatDateShort } from "@/lib/dates";
import type { ClientAccount } from "@/lib/client-portal/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Données de l'espace client connecté.
 *
 * La RLS fait ici le gros du travail (voir migration 13) : un client ne peut
 * lire que son entreprise. On reste néanmoins explicite sur les colonnes
 * demandées — on ne sélectionne jamais montants ni statut de facturation,
 * qui n'ont pas à apparaître chez le client.
 */

export type ClientTask = {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  status: string;
  dueOn: string | null;
  completedOn: string | null;
};

export type ClientRequestItem = {
  id: string;
  content: string;
  status: string;
  createdOn: string;
  promisedDate: string | null;
  reply: string | null;
};

export type ClientSpaceData = {
  waitingOnClient: ClientTask[];
  inProgress: ClientTask[];
  upcoming: ClientTask[];
  completed: ClientTask[];
  documents: { id: string; name: string; url: string | null; date: string }[];
  reports: {
    id: string;
    title: string;
    period: string;
    summary: string | null;
  }[];
  metrics: { label: string; value: string }[];
  requests: ClientRequestItem[];
  welcomeMessage: string | null;
  voiceEnabled: boolean;
};

type RawTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  projects: { name: string } | { name: string }[] | null;
};

function toClientTask(task: RawTask): ClientTask {
  const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    project: project?.name ?? null,
    status: task.status,
    dueOn: task.due_date ? formatDateShort(task.due_date) : null,
    completedOn: task.completed_at ? formatDateShort(task.completed_at) : null,
  };
}

export async function loadClientSpace(
  account: ClientAccount
): Promise<ClientSpaceData> {
  const supabase = await createClient();

  const [
    { data: rawTasks },
    { data: rawDocuments },
    { data: rawReports },
    { data: rawRequests },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, due_date, completed_at, projects(name)")
      .eq("company_id", account.companyId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("company_documents")
      .select("id, name, external_url, document_date, created_at")
      .eq("company_id", account.companyId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("reports")
      .select("id, title, period_start, period_end, content")
      .eq("company_id", account.companyId)
      .order("period_end", { ascending: false })
      .limit(12),
    supabase
      .from("client_requests")
      .select("id, content, status, created_at, promised_date, assistant_reply")
      .eq("company_id", account.companyId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("client_portal_settings")
      .select("welcome_message, voice_enabled")
      .eq("company_id", account.companyId)
      .maybeSingle(),
  ]);

  const tasks = ((rawTasks ?? []) as unknown as RawTask[]).map(toClientTask);

  const reports = (rawReports ?? []).map((report) => {
    const content = report.content as
      | { sections?: { key: string; text: string }[] }
      | null;
    return {
      id: report.id,
      title: report.title,
      period: `${formatDateShort(report.period_start)} → ${formatDateShort(report.period_end)}`,
      summary:
        content?.sections?.find((s) => s.key === "resume")?.text || null,
    };
  });

  // Indicateurs du rapport le plus récent.
  const latestContent = (rawReports ?? [])[0]?.content as
    | { metrics?: { label: string; value: string }[] }
    | null;

  return {
    waitingOnClient: tasks.filter((t) => t.status === "en_attente_client"),
    inProgress: tasks.filter((t) => t.status === "en_cours"),
    upcoming: tasks
      .filter(
        (t) =>
          t.status !== "terminee" &&
          t.status !== "en_attente_client" &&
          t.dueOn !== null
      )
      .slice(0, 12),
    completed: tasks.filter((t) => t.status === "terminee").slice(0, 60),
    documents: (rawDocuments ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      url: d.external_url,
      date: formatDateShort(d.document_date ?? d.created_at),
    })),
    reports,
    metrics: (latestContent?.metrics ?? []).slice(0, 8),
    requests: (rawRequests ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      status: r.status,
      createdOn: formatDateShort(r.created_at),
      promisedDate: r.promised_date ? formatDateShort(r.promised_date) : null,
      reply: r.assistant_reply,
    })),
    welcomeMessage: settings?.welcome_message ?? null,
    voiceEnabled: settings?.voice_enabled ?? true,
  };
}

/** Compteurs affichés en tête de l'espace client. */
export function buildClientStats(data: ClientSpaceData) {
  return [
    { label: "Attend votre retour", value: data.waitingOnClient.length },
    { label: "En cours", value: data.inProgress.length },
    { label: "Réalisé", value: data.completed.length },
    { label: "Vos demandes", value: data.requests.length },
  ];
}
