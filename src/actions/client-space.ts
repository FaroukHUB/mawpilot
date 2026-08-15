"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loadBudgetSettings } from "@/lib/ai/budget";
import { computeCost } from "@/lib/ai/pricing";
import { analyseClientRequest } from "@/lib/client-portal/assistant";
import { loadAssistantContext } from "@/lib/client-portal/client-data";
import { getClientAccount } from "@/lib/client-portal/session";
import { notifyUser } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/companies";

/**
 * Conversation de l'espace client connecté.
 *
 * Le client parle ou écrit ; l'assistant répond, puis classe : une vraie
 * demande devient une ligne de suivi côté prestataire, une simple question
 * reste une question. Aucune date n'est jamais promise ici — seul le
 * prestataire s'engage (voir acceptClientRequest).
 */

const messageSchema = z.object({
  message: z.string().trim().min(2, "Message trop court.").max(2000),
  is_voice: z.coerce.boolean().default(false),
});

const MAX_MESSAGES_PER_HOUR = 20;

export type SpaceReply = {
  reply: string;
  /** Vrai si le message a été enregistré comme demande à traiter. */
  requestCreated: boolean;
  requestId: string | null;
  outOfScope: boolean;
};

export async function sendSpaceMessage(
  input: unknown
): Promise<ActionResult<SpaceReply>> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Message invalide." };
  }

  const account = await getClientAccount();
  if (!account) return { error: "Session expirée, reconnectez-vous." };

  const admin = createAdminClient();

  // Le propriétaire du dossier : c'est lui qu'on notifie.
  const { data: link } = await admin
    .from("client_users")
    .select("owner_user_id")
    .eq("id", account.clientUserId)
    .single();
  if (!link) return { error: "Compte introuvable." };

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await admin
    .from("client_messages")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .eq("author", "client")
    .gte("created_at", oneHourAgo);

  if ((recent ?? 0) >= MAX_MESSAGES_PER_HOUR) {
    return {
      error:
        "Vous avez envoyé beaucoup de messages coup sur coup. Reprenons dans un moment.",
    };
  }

  // 1. Le message du client est enregistré avant tout traitement : même si
  //    l'IA échoue, rien n'est perdu.
  await admin.from("client_messages").insert({
    user_id: link.owner_user_id,
    company_id: account.companyId,
    author: "client",
    content: parsed.data.message,
  });

  const { data: history } = await admin
    .from("client_messages")
    .select("author, content")
    .eq("company_id", account.companyId)
    .order("created_at", { ascending: false })
    .limit(11);

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

  const overview = await loadAssistantContext(account.companyId);

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
      // Le dernier élément est le message qu'on vient d'enregistrer.
      history: (history ?? []).slice(1).reverse(),
      quotaReached,
    });
  } catch (error) {
    console.error("Analyse de message (espace client) :", error);
    analysis = {
      reply:
        "Votre message est bien enregistré. Vous recevrez une réponse rapidement.",
      classification: "indeterminee" as const,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
  }

  // 2. Une simple question ne crée pas de ligne de suivi : seules les vraies
  //    demandes entrent dans la file du prestataire.
  const isRequest = analysis.classification !== "question";
  const outOfScope =
    quotaReached || analysis.classification === "supplementaire";

  let requestId: string | null = null;
  if (isRequest) {
    const { data: request } = await admin
      .from("client_requests")
      .insert({
        user_id: link.owner_user_id,
        company_id: account.companyId,
        contact_name: account.displayName,
        content: parsed.data.message,
        is_voice: parsed.data.is_voice,
        classification: analysis.classification,
        assistant_reply: analysis.reply,
        status: outOfScope ? "hors_forfait" : "en_analyse",
      })
      .select("id")
      .single();
    requestId = request?.id ?? null;
  }

  // 3. Réponse de l'assistant conservée dans le fil.
  await admin.from("client_messages").insert({
    user_id: link.owner_user_id,
    company_id: account.companyId,
    request_id: requestId,
    author: "assistant",
    content: analysis.reply,
  });

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
    title: outOfScope
      ? `Demande hors forfait — ${account.companyName}`
      : isRequest
        ? `Nouvelle demande — ${account.companyName}`
        : `Question client — ${account.companyName}`,
    body: `${account.displayName} : ${parsed.data.message.slice(0, 160)}`,
    url: "/demandes",
    alwaysEmail: outOfScope,
  });

  revalidatePath("/espace");
  revalidatePath("/demandes");

  return {
    data: {
      reply: analysis.reply,
      requestCreated: requestId !== null,
      requestId,
      outOfScope,
    },
  };
}
