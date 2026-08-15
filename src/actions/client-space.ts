"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loadBudgetSettings } from "@/lib/ai/budget";
import { computeCost } from "@/lib/ai/pricing";
import { analyseClientRequest } from "@/lib/client-portal/assistant";
import { getClientAccount } from "@/lib/client-portal/session";
import { notifyUser } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

/**
 * Dépôt d'une demande depuis l'espace client connecté.
 * Même traitement que le portail par lien : accusé de réception, classement
 * contre la charte, alerte au prestataire. Aucune date n'est promise ici.
 */

const requestSchema = z.object({
  message: z.string().trim().min(3, "Message trop court.").max(2000),
  is_voice: z.coerce.boolean().default(false),
});

const MAX_REQUESTS_PER_HOUR = 10;

export async function submitSpaceRequest(
  input: unknown
): Promise<ActionResult<{ reply: string; requestId: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }

  const account = await getClientAccount();
  if (!account) return { error: "Session expirée, reconnectez-vous." };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Le propriétaire du dossier : c'est lui qu'on notifie.
  const { data: link } = await admin
    .from("client_users")
    .select("owner_user_id")
    .eq("id", account.clientUserId)
    .single();
  if (!link) return { error: "Compte introuvable." };

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return {
      error: "Trop de demandes envoyées coup sur coup. Merci de patienter.",
    };
  }

  // Contexte et charte, lus avec les droits du propriétaire.
  const { data: settingsRow } = await admin
    .from("client_portal_settings")
    .select("*")
    .eq("company_id", account.companyId)
    .maybeSingle();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: monthlyCount } = await admin
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .gte("created_at", monthStart.toISOString());

  const quota = settingsRow?.monthly_request_quota ?? 0;
  const quotaReached = quota > 0 && (monthlyCount ?? 0) >= quota;

  const { data: openTasks } = await admin
    .from("tasks")
    .select("title, status")
    .eq("company_id", account.companyId)
    .neq("status", "archivee")
    .limit(40);

  const tasks = openTasks ?? [];
  const overview = {
    completed: tasks
      .filter((t) => t.status === "terminee")
      .slice(0, 10)
      .map((t) => ({ id: "", title: t.title, project: null, completedOn: null, dueOn: null })),
    inProgress: tasks
      .filter((t) => t.status === "en_cours")
      .map((t) => ({ id: "", title: t.title, project: null, completedOn: null, dueOn: null })),
    waitingOnClient: tasks
      .filter((t) => t.status === "en_attente_client")
      .map((t) => ({ id: "", title: t.title, project: null, completedOn: null, dueOn: null })),
    upcoming: [],
    documents: [],
    reports: [],
    metrics: [],
  };

  const session = {
    tokenId: "",
    userId: link.owner_user_id,
    companyId: account.companyId,
    companyName: account.companyName,
    companyColor: account.companyColor,
    contactName: account.displayName,
    settings: {
      isEnabled: true,
      welcomeMessage: settingsRow?.welcome_message ?? null,
      includedScope: settingsRow?.included_scope ?? null,
      excludedScope: settingsRow?.excluded_scope ?? null,
      monthlyRequestQuota: quota,
      outOfScopeMessage:
        settingsRow?.out_of_scope_message ??
        "Cette demande sort des prestations incluses. Je la transmets pour étude.",
      quotaReachedMessage:
        settingsRow?.quota_reached_message ??
        "Vous avez atteint le nombre de demandes incluses ce mois-ci.",
      tone: settingsRow?.tone ?? "professionnel et chaleureux",
      aiReplyEnabled: settingsRow?.ai_reply_enabled ?? true,
      voiceEnabled: settingsRow?.voice_enabled ?? true,
      showCompleted: true,
      showInProgress: true,
      showWaitingClient: true,
      showUpcoming: true,
      showDocuments: true,
      showReports: true,
      showMetrics: true,
    },
  };

  let analysis;
  try {
    analysis = await analyseClientRequest({
      session,
      overview,
      message: parsed.data.message,
      history: [],
      quotaReached,
    });
  } catch (error) {
    console.error("Analyse de demande (espace client) :", error);
    analysis = {
      reply:
        "Votre demande est bien enregistrée. Vous recevrez une réponse rapidement.",
      classification: "indeterminee" as const,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
  }

  const { data: request, error } = await admin
    .from("client_requests")
    .insert({
      user_id: link.owner_user_id,
      company_id: account.companyId,
      contact_name: account.displayName,
      content: parsed.data.message,
      is_voice: parsed.data.is_voice,
      classification: analysis.classification,
      assistant_reply: analysis.reply,
      status:
        quotaReached || analysis.classification === "supplementaire"
          ? "hors_forfait"
          : "en_analyse",
    })
    .select("id")
    .single();

  if (error || !request) {
    return { error: "Enregistrement impossible. Réessayez dans un instant." };
  }

  if (analysis.usage.inputTokens > 0) {
    const budget = await loadBudgetSettings(admin, link.owner_user_id);
    await admin.from("ai_requests").insert({
      user_id: link.owner_user_id,
      user_message: `[espace client — ${account.companyName}] ${parsed.data.message.slice(0, 400)}`,
      input_mode: parsed.data.is_voice ? "ia_voix" : "ia_texte",
      intent: "demande_client",
      status: "executee",
      input_tokens: analysis.usage.inputTokens,
      cached_input_tokens: analysis.usage.cachedInputTokens,
      output_tokens: analysis.usage.outputTokens,
      cost_usd: computeCost(analysis.usage, budget.rates),
    });
  }

  await notifyUser(admin, link.owner_user_id, {
    title:
      quotaReached || analysis.classification === "supplementaire"
        ? `Demande hors forfait — ${account.companyName}`
        : `Nouvelle demande — ${account.companyName}`,
    body: `${account.displayName} : ${parsed.data.message.slice(0, 160)}`,
    url: "/demandes",
    alwaysEmail:
      quotaReached || analysis.classification === "supplementaire",
  });

  revalidatePath("/espace");
  revalidatePath("/demandes");

  return { data: { reply: analysis.reply, requestId: request.id } };
}
