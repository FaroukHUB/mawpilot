import "server-only";

import { formatDateLong, formatDateShort } from "@/lib/dates";
import type { ClientAccount } from "@/lib/client-portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Données de l'espace client connecté.
 *
 * La RLS fait ici le gros du travail (voir migration 13) : un client ne peut
 * lire que son entreprise. On reste néanmoins explicite sur les colonnes
 * demandées — on ne sélectionne jamais montants, temps passé ni statut de
 * facturation, qui n'ont pas à apparaître chez le client.
 */

const BUCKET = "documents";
const SIGNED_URL_SECONDS = 60 * 30;

export type ClientTask = {
  id: string;
  title: string;
  description: string | null;
  project: string | null;
  status: string;
  dueOn: string | null;
  completedOn: string | null;
  isLate: boolean;
};

export type ClientFile = {
  id: string;
  name: string;
  url: string | null;
  isImage: boolean;
};

export type ClientRequestItem = {
  id: string;
  content: string;
  status: string;
  createdOn: string;
  promisedDate: string | null;
  reply: string | null;
  /** Réponse écrite par le prestataire lui-même, distincte de l'assistant. */
  ownerReply: string | null;
  ownerRepliedOn: string | null;
  attachments: ClientFile[];
};

export type ClientProject = {
  id: string;
  name: string;
  description: string | null;
  total: number;
  done: number;
  /** Pourcentage entier, 0 si le projet n'a aucune tâche. */
  progress: number;
};

export type ClientReport = {
  id: string;
  title: string;
  period: string;
  summary: string | null;
  sections: { title: string; text: string }[];
};

export type ClientMessage = {
  id: string;
  author: "client" | "assistant" | "utilisateur";
  content: string;
  createdOn: string;
  attachments: ClientFile[];
};

export type ClientSpaceData = {
  waitingOnClient: ClientTask[];
  inProgress: ClientTask[];
  upcoming: ClientTask[];
  completed: ClientTask[];
  /** Terminé sur le mois en cours, pour la mise en avant « ce mois-ci ». */
  completedThisMonth: ClientTask[];
  projects: ClientProject[];
  documents: {
    id: string;
    name: string;
    description: string | null;
    url: string | null;
    date: string;
    isFile: boolean;
  }[];
  reports: ClientReport[];
  metrics: { label: string; value: string }[];
  requests: ClientRequestItem[];
  conversation: ClientMessage[];
  nextDeadline: ClientTask | null;
  lastActivityOn: string | null;
  /** Part des tâches terminées, tous projets confondus. */
  overallProgress: number;
  welcomeMessage: string | null;
  voiceEnabled: boolean;
  aiReplyEnabled: boolean;
  includedScope: string | null;
};

type RawTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  project_id: string | null;
  projects: { name: string } | { name: string }[] | null;
};

function toClientTask(task: RawTask, today: string): ClientTask {
  const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  const open = task.status !== "terminee";
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    project: project?.name ?? null,
    status: task.status,
    dueOn: task.due_date ? formatDateShort(task.due_date) : null,
    completedOn: task.completed_at ? formatDateShort(task.completed_at) : null,
    isLate: open && task.due_date !== null && task.due_date < today,
  };
}

/** Sections d'un rapport, quelle que soit la forme historique du JSON. */
function extractSections(
  content: unknown
): { title: string; text: string }[] {
  const sections = (content as { sections?: unknown })?.sections;
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => {
      const row = section as { key?: string; title?: string; text?: string };
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) return null;
      return { title: row.title?.trim() || sectionLabel(row.key), text };
    })
    .filter((s): s is { title: string; text: string } => s !== null);
}

const SECTION_LABELS: Record<string, string> = {
  resume: "En résumé",
  realise: "Ce qui a été réalisé",
  en_cours: "En cours",
  a_venir: "La suite",
  points_attention: "Points d'attention",
  resultats: "Résultats",
};

function sectionLabel(key: string | undefined): string {
  if (!key) return "Détail";
  return SECTION_LABELS[key] ?? key.replace(/_/g, " ");
}

type AttachmentIndex = {
  byRequest: Map<string, ClientFile[]>;
  byMessage: Map<string, ClientFile[]>;
};

/**
 * Pièces jointes de l'entreprise, signées pour consultation.
 *
 * La signature passe par la clé d'administration : les fichiers déposés par
 * un client vivent sous `clients/` dans le bucket privé, où le client n'a
 * aucun droit direct. La requête est bornée à son entreprise.
 */
async function loadAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
): Promise<AttachmentIndex> {
  const empty: AttachmentIndex = { byRequest: new Map(), byMessage: new Map() };

  const { data } = await supabase
    .from("client_attachments")
    .select("id, name, mime_type, storage_path, request_id, message_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(120);

  if (!data || data.length === 0) return empty;

  let signer: ReturnType<typeof createAdminClient> | null = null;
  try {
    signer = createAdminClient();
  } catch {
    // Sans clé d'administration, on affiche les noms sans lien plutôt que
    // de faire échouer tout l'espace client.
    signer = null;
  }

  for (const row of data) {
    let url: string | null = null;
    if (signer) {
      const { data: signed } = await signer.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
      url = signed?.signedUrl ?? null;
    }

    const file: ClientFile = {
      id: row.id,
      name: row.name,
      url,
      isImage: String(row.mime_type).startsWith("image/"),
    };

    for (const [key, map] of [
      [row.request_id, empty.byRequest],
      [row.message_id, empty.byMessage],
    ] as const) {
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(file);
      else map.set(key, [file]);
    }
  }

  return empty;
}

export async function loadClientSpace(
  account: ClientAccount
): Promise<ClientSpaceData> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [
    { data: rawTasks },
    { data: rawProjects },
    { data: rawDocuments },
    { data: rawReports },
    { data: rawRequests },
    { data: rawMessages },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, due_date, completed_at, project_id, projects(name)"
      )
      .eq("company_id", account.companyId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(300),
    supabase
      .from("projects")
      .select("id, name, description, status")
      .eq("company_id", account.companyId)
      .neq("status", "archive")
      .order("created_at", { ascending: false }),
    supabase
      .from("company_documents")
      .select(
        "id, name, description, external_url, storage_path, document_date, created_at"
      )
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
      .select(
        "id, content, status, created_at, promised_date, assistant_reply, owner_reply, owner_replied_at"
      )
      .eq("company_id", account.companyId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("client_messages")
      .select("id, author, content, created_at")
      .eq("company_id", account.companyId)
      .order("created_at", { ascending: true })
      .limit(60),
    supabase
      .from("client_portal_settings")
      .select("welcome_message, voice_enabled, ai_reply_enabled, included_scope")
      .eq("company_id", account.companyId)
      .maybeSingle(),
  ]);

  const attachments = await loadAttachments(supabase, account.companyId);

  const raw = (rawTasks ?? []) as unknown as RawTask[];
  const tasks = raw.map((task) => toClientTask(task, today));
  const completed = tasks.filter((t) => t.status === "terminee");

  // Avancement par projet : le client voit une barre, pas une liste brute.
  const projects: ClientProject[] = (rawProjects ?? [])
    .map((project) => {
      const own = raw.filter((t) => t.project_id === project.id);
      const done = own.filter((t) => t.status === "terminee").length;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        total: own.length,
        done,
        progress: own.length === 0 ? 0 : Math.round((done / own.length) * 100),
      };
    })
    .filter((project) => project.total > 0);

  const openTasks = raw.filter((t) => t.status !== "terminee");
  const nextDue = openTasks
    .filter((t) => t.due_date !== null)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];

  const lastCompleted = raw.find((t) => t.completed_at !== null)?.completed_at;

  // Les fichiers privés ne sont accessibles que par URL signée courte.
  const documents = await Promise.all(
    (rawDocuments ?? []).map(async (doc) => {
      let url = doc.external_url as string | null;
      if (!url && doc.storage_path) {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS);
        url = data?.signedUrl ?? null;
      }
      return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        url,
        date: formatDateShort(doc.document_date ?? doc.created_at),
        isFile: Boolean(doc.storage_path),
      };
    })
  );

  const reports: ClientReport[] = (rawReports ?? []).map((report) => {
    const sections = extractSections(report.content);
    return {
      id: report.id,
      title: report.title,
      period: `${formatDateShort(report.period_start)} → ${formatDateShort(report.period_end)}`,
      summary:
        sections.find((s) => s.title === SECTION_LABELS.resume)?.text ??
        sections[0]?.text ??
        null,
      sections,
    };
  });

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
    completed: completed.slice(0, 60),
    completedThisMonth: raw
      .filter((t) => (t.completed_at ?? "") >= monthStart)
      .map((t) => toClientTask(t, today)),
    projects,
    documents,
    reports,
    metrics: (latestContent?.metrics ?? []).slice(0, 8),
    requests: (rawRequests ?? []).map((r) => ({
      id: r.id,
      content: r.content,
      status: r.status,
      createdOn: formatDateShort(r.created_at),
      promisedDate: r.promised_date ? formatDateShort(r.promised_date) : null,
      reply: r.assistant_reply,
      ownerReply: r.owner_reply ?? null,
      ownerRepliedOn: r.owner_replied_at
        ? formatDateShort(r.owner_replied_at)
        : null,
      attachments: attachments.byRequest.get(r.id) ?? [],
    })),
    conversation: (rawMessages ?? []).map((m) => ({
      id: m.id,
      author: m.author as ClientMessage["author"],
      content: m.content,
      createdOn: formatDateShort(m.created_at),
      attachments: attachments.byMessage.get(m.id) ?? [],
    })),
    nextDeadline: nextDue ? toClientTask(nextDue, today) : null,
    lastActivityOn: lastCompleted ? formatDateLong(lastCompleted) : null,
    overallProgress:
      tasks.length === 0
        ? 0
        : Math.round((completed.length / tasks.length) * 100),
    welcomeMessage: settings?.welcome_message ?? null,
    voiceEnabled: settings?.voice_enabled ?? true,
    aiReplyEnabled: settings?.ai_reply_enabled ?? true,
    includedScope: settings?.included_scope ?? null,
  };
}

/**
 * Contexte réduit passé à l'assistant client.
 * Chargé avec les droits du propriétaire (clé service_role) parce que la
 * réponse est rédigée côté serveur, hors session du client.
 */
export async function loadAssistantContext(companyId: string) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from("tasks")
    .select("title, status, due_date, completed_at")
    .eq("company_id", companyId)
    .neq("status", "archivee")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(60);

  const rows = data ?? [];
  const map = (status: string) =>
    rows
      .filter((t) => t.status === status)
      .map((t) => ({
        id: "",
        title: t.title,
        project: null,
        completedOn: t.completed_at ? formatDateShort(t.completed_at) : null,
        dueOn: t.due_date ? formatDateShort(t.due_date) : null,
      }));

  return {
    completed: map("terminee").slice(0, 10),
    inProgress: map("en_cours"),
    waitingOnClient: map("en_attente_client"),
    upcoming: rows
      .filter((t) => t.status !== "terminee" && t.due_date && t.due_date >= today)
      .slice(0, 8)
      .map((t) => ({
        id: "",
        title: t.title,
        project: null,
        completedOn: null,
        dueOn: t.due_date ? formatDateShort(t.due_date) : null,
      })),
    documents: [],
    reports: [],
    metrics: [],
  };
}

/** Compteurs affichés en tête de l'espace client. */
export function buildClientStats(data: ClientSpaceData) {
  return [
    { label: "Attend votre retour", value: data.waitingOnClient.length },
    { label: "En cours", value: data.inProgress.length },
    { label: "Terminé ce mois-ci", value: data.completedThisMonth.length },
    { label: "Vos demandes", value: data.requests.length },
  ];
}
