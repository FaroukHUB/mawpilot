"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { computeCost } from "@/lib/ai/pricing";
import { loadBudgetSettings } from "@/lib/ai/budget";
import { analyseClientRequest } from "@/lib/client-portal/assistant";
import {
  countRequestsThisMonth,
  loadPortalOverview,
  openPortalSession,
} from "@/lib/client-portal/data";
import { notifyUser } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/actions/companies";

/**
 * Actions accessibles depuis le portail client — SANS session utilisateur.
 *
 * Chaque action revalide le jeton à chaque appel : jamais de confiance
 * accordée à un identifiant transmis par le navigateur du client.
 * Le portail est en LECTURE SEULE sur les données métier : la seule écriture
 * possible est le dépôt d'une demande, qui n'affecte rien tant que
 * l'utilisateur ne l'a pas validée.
 */

const requestSchema = z.object({
  token: z.string().min(10).max(200),
  message: z.string().trim().min(3, "Message trop court.").max(2000),
  is_voice: z.coerce.boolean().default(false),
  raw_transcription: z.string().max(4000).optional(),
});

/** Limite anti-abus par entreprise : protège aussi le budget IA. */
const MAX_REQUESTS_PER_HOUR = 10;

export type SubmitResult = {
  reply: string;
  classification: string;
  requestId: string;
};

export async function submitClientRequest(
  input: unknown
): Promise<ActionResult<SubmitResult>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }

  const session = await openPortalSession(parsed.data.token);
  if (!session) return { error: "Ce lien n'est plus valide." };

  const supabase = createAdminClient();

  // Anti-abus : nombre de demandes dans l'heure écoulée.
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recentCount } = await supabase
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", session.companyId)
    .gte("created_at", oneHourAgo);

  if ((recentCount ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return {
      error:
        "Trop de demandes envoyées coup sur coup. Merci de patienter un moment.",
    };
  }

  const monthlyCount = await countRequestsThisMonth(session);
  const quota = session.settings.monthlyRequestQuota;
  const quotaReached = quota > 0 && monthlyCount >= quota;

  const overview = await loadPortalOverview(session);
  const { data: historyRows } = await supabase
    .from("client_messages")
    .select("author, content")
    .eq("company_id", session.companyId)
    .order("created_at", { ascending: false })
    .limit(6);

  let analysis;
  try {
    analysis = await analyseClientRequest({
      session,
      overview,
      message: parsed.data.message,
      history: (historyRows ?? []).reverse(),
      quotaReached,
    });
  } catch (error) {
    console.error("Analyse de demande client :", error);
    analysis = {
      reply:
        "Votre demande est bien enregistrée. Elle sera étudiée et vous recevrez une réponse rapidement.",
      classification: "indeterminee" as const,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
  }

  const { data: request, error } = await supabase
    .from("client_requests")
    .insert({
      user_id: session.userId,
      company_id: session.companyId,
      token_id: session.tokenId,
      contact_name: session.contactName,
      content: parsed.data.message,
      raw_transcription: parsed.data.raw_transcription ?? null,
      is_voice: parsed.data.is_voice,
      classification: analysis.classification,
      assistant_reply: analysis.reply,
      status: quotaReached
        ? "hors_forfait"
        : analysis.classification === "supplementaire"
          ? "hors_forfait"
          : "en_analyse",
    })
    .select("id")
    .single();

  if (error || !request) {
    return { error: "Enregistrement impossible. Réessayez dans un instant." };
  }

  await supabase.from("client_messages").insert([
    {
      user_id: session.userId,
      company_id: session.companyId,
      request_id: request.id,
      author: "client",
      content: parsed.data.message,
    },
    {
      user_id: session.userId,
      company_id: session.companyId,
      request_id: request.id,
      author: "assistant",
      content: analysis.reply,
    },
  ]);

  // Le coût de l'IA du portail est imputé au budget de l'utilisateur : il doit
  // le voir dans son compteur, pas le découvrir sur sa facture.
  if (analysis.usage.inputTokens > 0 || analysis.usage.outputTokens > 0) {
    const settings = await loadBudgetSettings(supabase, session.userId);
    await supabase.from("ai_requests").insert({
      user_id: session.userId,
      user_message: `[portail client — ${session.companyName}] ${parsed.data.message.slice(0, 500)}`,
      input_mode: parsed.data.is_voice ? "ia_voix" : "ia_texte",
      intent: "demande_client",
      status: "executee",
      input_tokens: analysis.usage.inputTokens,
      cached_input_tokens: analysis.usage.cachedInputTokens,
      output_tokens: analysis.usage.outputTokens,
      cost_usd: computeCost(analysis.usage, settings.rates),
    });
  }

  // Alerte immédiate : c'est le cœur de la promesse « je sais quand un client
  // dépasse le cadre ».
  const alertTitle = quotaReached
    ? `Quota dépassé — ${session.companyName}`
    : analysis.classification === "supplementaire"
      ? `Demande hors forfait — ${session.companyName}`
      : `Nouvelle demande — ${session.companyName}`;

  await notifyUser(supabase, session.userId, {
    title: alertTitle,
    body: `${session.contactName ? `${session.contactName} : ` : ""}${parsed.data.message.slice(0, 160)}`,
    url: `/demandes`,
    alwaysEmail: quotaReached || analysis.classification === "supplementaire",
  });

  revalidatePath("/demandes");
  revalidatePath("/dashboard");

  return {
    data: {
      reply: analysis.reply,
      classification: analysis.classification,
      requestId: request.id,
    },
  };
}
