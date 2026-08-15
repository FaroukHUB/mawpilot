import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateShort } from "@/lib/dates";
import { parseToken, verifyToken } from "@/lib/client-portal/tokens";

/**
 * ⚠ POINT D'AUDIT UNIQUE DU PORTAIL CLIENT ⚠
 *
 * Le portail n'a aucune session : la RLS ne peut donc pas le protéger.
 * C'est CE FICHIER, et lui seul, qui décide ce qu'un client voit.
 *
 * Règles appliquées ici, à ne jamais contourner ailleurs :
 * 1. toute requête est filtrée sur `company_id` issu du jeton vérifié ;
 * 2. aucune fonction ne renvoie une ligne brute — uniquement des formes
 *    curées, construites champ par champ ;
 * 3. ne sortent JAMAIS d'ici : temps passé, montants, statut de facturation,
 *    priorités, notes internes, mémoire IA, historique, accès rapides,
 *    contacts, et toute donnée d'une autre entreprise.
 *
 * `import "server-only"` fait échouer le build si ce module était importé
 * depuis un composant client.
 */

export type PortalSession = {
  tokenId: string;
  userId: string;
  companyId: string;
  companyName: string;
  companyColor: string;
  contactName: string | null;
  settings: PortalSettings;
};

export type PortalSettings = {
  isEnabled: boolean;
  welcomeMessage: string | null;
  includedScope: string | null;
  excludedScope: string | null;
  monthlyRequestQuota: number;
  outOfScopeMessage: string;
  quotaReachedMessage: string;
  tone: string;
  aiReplyEnabled: boolean;
  voiceEnabled: boolean;
  showCompleted: boolean;
  showInProgress: boolean;
  showWaitingClient: boolean;
  showUpcoming: boolean;
  showDocuments: boolean;
  showReports: boolean;
  showMetrics: boolean;
};

const DEFAULT_SETTINGS: PortalSettings = {
  isEnabled: true,
  welcomeMessage: null,
  includedScope: null,
  excludedScope: null,
  monthlyRequestQuota: 0,
  outOfScopeMessage:
    "Cette demande sort des prestations incluses dans votre forfait. Je la transmets pour étude, vous recevrez une proposition rapidement.",
  quotaReachedMessage:
    "Vous avez atteint le nombre de demandes incluses ce mois-ci. Votre demande est enregistrée et sera étudiée en priorité.",
  tone: "professionnel et chaleureux",
  aiReplyEnabled: true,
  voiceEnabled: true,
  showCompleted: true,
  showInProgress: true,
  showWaitingClient: true,
  showUpcoming: true,
  showDocuments: true,
  showReports: true,
  showMetrics: true,
};

/**
 * Vérifie un jeton et ouvre une session de portail.
 * Retourne `null` pour tout jeton inconnu, expiré, révoqué ou désactivé —
 * sans jamais distinguer les cas (on ne renseigne pas un curieux).
 */
export async function openPortalSession(
  fullToken: string
): Promise<PortalSession | null> {
  const { prefix, valid } = parseToken(fullToken);
  if (!valid) return null;

  const supabase = createAdminClient();

  const { data: token } = await supabase
    .from("client_access_tokens")
    .select(
      "id, user_id, company_id, contact_id, token_hash, expires_at, revoked_at, use_count, companies(name, color), company_contacts(name)"
    )
    .eq("token_prefix", prefix)
    .maybeSingle();

  if (!token) return null;
  if (!verifyToken(fullToken, token.token_hash)) return null;
  if (token.revoked_at) return null;
  if (token.expires_at && new Date(token.expires_at) < new Date()) return null;

  // Supabase type les jointures comme des tableaux : on normalise.
  const rawCompany = token.companies as
    | { name: string; color: string }
    | { name: string; color: string }[]
    | null;
  const company = Array.isArray(rawCompany) ? rawCompany[0] : rawCompany;
  if (!company) return null;

  const rawContact = token.company_contacts as
    | { name: string }
    | { name: string }[]
    | null;
  const contact = Array.isArray(rawContact) ? rawContact[0] : rawContact;

  const { data: rawSettings } = await supabase
    .from("client_portal_settings")
    .select("*")
    .eq("company_id", token.company_id)
    .maybeSingle();

  const settings: PortalSettings = rawSettings
    ? {
        isEnabled: rawSettings.is_enabled,
        welcomeMessage: rawSettings.welcome_message,
        includedScope: rawSettings.included_scope,
        excludedScope: rawSettings.excluded_scope,
        monthlyRequestQuota: rawSettings.monthly_request_quota ?? 0,
        outOfScopeMessage: rawSettings.out_of_scope_message,
        quotaReachedMessage: rawSettings.quota_reached_message,
        tone: rawSettings.tone,
        aiReplyEnabled: rawSettings.ai_reply_enabled,
        voiceEnabled: rawSettings.voice_enabled,
        showCompleted: rawSettings.show_completed,
        showInProgress: rawSettings.show_in_progress,
        showWaitingClient: rawSettings.show_waiting_client,
        showUpcoming: rawSettings.show_upcoming,
        showDocuments: rawSettings.show_documents,
        showReports: rawSettings.show_reports,
        showMetrics: rawSettings.show_metrics,
      }
    : DEFAULT_SETTINGS;

  if (!settings.isEnabled) return null;

  // Trace d'usage : utile pour repérer un lien qui circule anormalement.
  await supabase
    .from("client_access_tokens")
    .update({
      last_used_at: new Date().toISOString(),
      use_count: (token.use_count ?? 0) + 1,
    })
    .eq("id", token.id);

  return {
    tokenId: token.id,
    userId: token.user_id,
    companyId: token.company_id,
    companyName: company.name,
    companyColor: company.color,
    contactName: contact?.name ?? null,
    settings,
  };
}

// ---------------------------------------------------------------------------
// Données curées — chaque champ est choisi explicitement
// ---------------------------------------------------------------------------

export type PortalTask = {
  id: string;
  title: string;
  project: string | null;
  completedOn: string | null;
  dueOn: string | null;
};

export type PortalDocument = {
  id: string;
  name: string;
  url: string | null;
  date: string | null;
};

export type PortalReport = {
  id: string;
  title: string;
  period: string;
  sharedOn: string | null;
  summary: string | null;
};

export type PortalMetric = { label: string; value: string };

export type PortalOverview = {
  completed: PortalTask[];
  inProgress: PortalTask[];
  waitingOnClient: PortalTask[];
  upcoming: PortalTask[];
  documents: PortalDocument[];
  reports: PortalReport[];
  metrics: PortalMetric[];
};

/** Ne renvoie que des tâches marquées visibles, jamais archivées. */
async function fetchTasks(companyId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, completed_at, projects(name)")
    .eq("company_id", companyId)
    .eq("is_client_visible", true)
    .neq("status", "archivee")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(200);

  return (data ?? []) as unknown as RawPortalTask[];
}

type RawPortalTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  projects: { name: string } | { name: string }[] | null;
};

function toPortalTask(task: RawPortalTask): PortalTask {
  // Construction champ par champ : impossible de laisser fuir une colonne.
  const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  return {
    id: task.id,
    title: task.title,
    project: project?.name ?? null,
    completedOn: task.completed_at ? formatDateShort(task.completed_at) : null,
    dueOn: task.due_date ? formatDateShort(task.due_date) : null,
  };
}

export async function loadPortalOverview(
  session: PortalSession
): Promise<PortalOverview> {
  const supabase = createAdminClient();
  const { settings } = session;
  const today = new Date().toISOString().slice(0, 10);

  const tasks = await fetchTasks(session.companyId);

  const completed = settings.showCompleted
    ? tasks.filter((t) => t.status === "terminee").slice(0, 40).map(toPortalTask)
    : [];
  const inProgress = settings.showInProgress
    ? tasks.filter((t) => t.status === "en_cours").map(toPortalTask)
    : [];
  const waitingOnClient = settings.showWaitingClient
    ? tasks.filter((t) => t.status === "en_attente_client").map(toPortalTask)
    : [];
  const upcoming = settings.showUpcoming
    ? tasks
        .filter(
          (t) =>
            t.status !== "terminee" &&
            t.due_date !== null &&
            t.due_date >= today
        )
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
        .slice(0, 10)
        .map(toPortalTask)
    : [];

  let documents: PortalDocument[] = [];
  if (settings.showDocuments) {
    const { data } = await supabase
      .from("company_documents")
      .select("id, name, external_url, document_date, created_at")
      .eq("company_id", session.companyId)
      .eq("is_client_visible", true)
      .eq("status", "actif")
      .order("created_at", { ascending: false })
      .limit(30);

    documents = (data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      url: d.external_url,
      date: formatDateShort(d.document_date ?? d.created_at),
    }));
  }

  let reports: PortalReport[] = [];
  let metrics: PortalMetric[] = [];
  if (settings.showReports || settings.showMetrics) {
    // UNIQUEMENT les rapports déjà partagés : jamais un brouillon.
    const { data } = await supabase
      .from("reports")
      .select("id, title, period_start, period_end, shared_at, content")
      .eq("company_id", session.companyId)
      .eq("status", "partage")
      .order("period_end", { ascending: false })
      .limit(12);

    const rows = data ?? [];

    if (settings.showReports) {
      reports = rows.map((r) => {
        const content = r.content as
          | { sections?: { key: string; text: string }[] }
          | null;
        const resume =
          content?.sections?.find((s) => s.key === "resume")?.text ?? null;
        return {
          id: r.id,
          title: r.title,
          period: `${formatDateShort(r.period_start)} → ${formatDateShort(r.period_end)}`,
          sharedOn: r.shared_at ? formatDateShort(r.shared_at) : null,
          summary: resume,
        };
      });
    }

    if (settings.showMetrics && rows.length > 0) {
      const content = rows[0].content as
        | { metrics?: { label: string; value: string }[] }
        | null;
      metrics = (content?.metrics ?? []).slice(0, 8);
    }
  }

  return {
    completed,
    inProgress,
    waitingOnClient,
    upcoming,
    documents,
    reports,
    metrics,
  };
}

/** Historique de conversation visible par le client. */
export async function loadPortalMessages(session: PortalSession, limit = 30) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("client_messages")
    .select("id, author, content, created_at")
    .eq("company_id", session.companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).reverse().map((m) => ({
    id: m.id,
    author: m.author as "client" | "assistant" | "utilisateur",
    content: m.content,
    createdAt: m.created_at,
  }));
}

/** Nombre de demandes déposées ce mois — sert au contrôle de quota. */
export async function countRequestsThisMonth(
  session: PortalSession
): Promise<number> {
  const supabase = createAdminClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", session.companyId)
    .gte("created_at", monthStart.toISOString());

  return count ?? 0;
}
