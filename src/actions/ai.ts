"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loadBudgetState } from "@/lib/ai/budget";
import { buildRollingSummary, loadConversationContext, MAX_HISTORY_MESSAGES } from "@/lib/ai/context";
import { runInterpretation, type ProposedAction } from "@/lib/ai/interpret";
import { callOpenAIModel } from "@/lib/ai/model-caller";
import { getTextModel, isOpenAIConfigured } from "@/lib/ai/openai";
import { computeCost } from "@/lib/ai/pricing";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { executeReadFunction } from "@/lib/ai/read-executors";
import { isReadFunction, isWriteFunction } from "@/lib/ai/functions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

const askSchema = z.object({
  conversation_id: z.uuid(),
  message: z.string().trim().min(1, "Message vide.").max(4000),
  input_mode: z.enum(["ia_texte", "ia_voix"]).default("ia_texte"),
});

export type AskResult = {
  requestId: string;
  message: string;
  proposedActions: ProposedAction[];
  issues: string[];
  /** Coût de cette demande en dollars, et budget mis à jour. */
  costUsd: number;
  budget: {
    spentThisMonthUsd: number;
    remainingUsd: number;
    creditUsd: number;
    isLow: boolean;
  };
};

/**
 * Conversation globale : réutilisée par le bouton « Parler à MAW », qui doit
 * être disponible depuis n'importe quelle page sans créer une conversation
 * à chaque ouverture.
 */
export async function getOrCreateGlobalConversation(): Promise<
  ActionResult<{ id: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", user.id)
    .is("company_id", null)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { data: { id: existing.id } };

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: user.id,
      company_id: null,
      title: "Conversation générale",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: "Création impossible : " + error.message };
  return { data: { id: data.id } };
}

/** Crée une conversation (globale si `companyId` est absent). */
export async function createConversation(
  companyId?: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  let title = "Conversation générale";
  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .eq("user_id", user.id)
      .single();
    if (!company) return { error: "Entreprise introuvable." };
    title = company.name;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: user.id,
      company_id: companyId ?? null,
      title,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  revalidatePath("/assistant");
  return { data: { id: data.id } };
}

/**
 * Interprète un message : lit les données nécessaires et propose des actions.
 * Aucune écriture n'est effectuée ici — l'utilisateur confirmera.
 */
export async function askAssistant(
  input: unknown
): Promise<ActionResult<AskResult>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  if (!isOpenAIConfigured()) {
    return {
      error:
        "L'assistant n'est pas configuré : ajoutez OPENAI_API_KEY dans .env.local.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const rate = await checkAiRateLimit(supabase, user.id);
  if (!rate.allowed) return { error: rate.message };

  // Garde-fou budget : on refuse d'appeler le modèle si le crédit déclaré est
  // épuisé, plutôt que de laisser filer la facture.
  const budgetBefore = await loadBudgetState(supabase, user.id);
  if (budgetBefore.isExhausted) {
    return {
      error:
        "Crédit IA épuisé d'après votre compteur. Rechargez votre compte OpenAI " +
        "puis mettez à jour le crédit dans Paramètres → Budget de l'assistant.",
    };
  }

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, summary")
    .eq("id", parsed.data.conversation_id)
    .eq("user_id", user.id)
    .single();
  if (!conversation) return { error: "Conversation introuvable." };

  // Trace la demande dès le départ (sert aussi au comptage anti-abus).
  const { data: request, error: requestError } = await supabase
    .from("ai_requests")
    .insert({
      user_id: user.id,
      user_message: parsed.data.message,
      input_mode: parsed.data.input_mode,
      status: "proposee",
    })
    .select("id")
    .single();
  if (requestError || !request) {
    return { error: "Impossible d'enregistrer la demande." };
  }

  await supabase.from("ai_messages").insert({
    user_id: user.id,
    conversation_id: conversation.id,
    role: "user",
    content: parsed.data.message,
    ai_request_id: request.id,
  });

  try {
    const context = await loadConversationContext(
      supabase,
      user.id,
      conversation.id
    );

    const result = await runInterpretation({
      systemPrompt: context.systemPrompt,
      history: context.history,
      userMessage: parsed.data.message,
      callModel: callOpenAIModel,
      executeRead: (name, args) => {
        if (!isReadFunction(name)) {
          throw new Error("Fonction de lecture non autorisée.");
        }
        return executeReadFunction(supabase, user.id, name, args);
      },
    });

    const costUsd = computeCost(result.usage, budgetBefore.settings.rates);

    await supabase
      .from("ai_requests")
      .update({
        intent: result.proposedActions.map((a) => a.name).join(", ") || "réponse",
        proposed_actions: result.proposedActions,
        status: result.proposedActions.length > 0 ? "proposee" : "executee",
        model: getTextModel(),
        input_tokens: result.usage.inputTokens,
        cached_input_tokens: result.usage.cachedInputTokens,
        output_tokens: result.usage.outputTokens,
        cost_usd: costUsd,
      })
      .eq("id", request.id)
      .eq("user_id", user.id);

    if (result.message) {
      await supabase.from("ai_messages").insert({
        user_id: user.id,
        conversation_id: conversation.id,
        role: "assistant",
        content: result.message,
        ai_request_id: request.id,
      });
    }

    await refreshConversationState(supabase, user.id, conversation.id);

    const budgetAfter = await loadBudgetState(supabase, user.id);
    revalidatePath("/assistant");
    revalidatePath("/parametres");

    return {
      data: {
        requestId: request.id,
        message: result.message,
        proposedActions: result.proposedActions,
        issues: result.issues,
        costUsd,
        budget: {
          spentThisMonthUsd: budgetAfter.spentThisMonthUsd,
          remainingUsd: budgetAfter.remainingUsd,
          creditUsd: budgetAfter.creditUsd,
          isLow: budgetAfter.isLow,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inattendue.";
    await supabase
      .from("ai_requests")
      .update({ status: "echouee", error_message: message })
      .eq("id", request.id)
      .eq("user_id", user.id);
    return { error: `L'assistant n'a pas pu répondre : ${message}` };
  }
}

const confirmSchema = z.object({
  request_id: z.uuid(),
  conversation_id: z.uuid(),
  actions: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.record(z.string(), z.unknown()),
      })
    )
    .min(1, "Aucune action à exécuter."),
});

/**
 * Exécute les actions confirmées, dans UNE transaction PostgreSQL (D-007) :
 * tout réussit ou tout est annulé.
 */
export async function confirmAiActions(
  input: unknown
): Promise<ActionResult<{ executed: { description: string }[] }>> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  // Revalidation serveur : on ne fait jamais confiance au client.
  for (const action of parsed.data.actions) {
    if (!isWriteFunction(action.name)) {
      return { error: `Action non autorisée : ${action.name}.` };
    }
  }

  const { data: request } = await supabase
    .from("ai_requests")
    .select("id, status")
    .eq("id", parsed.data.request_id)
    .eq("user_id", user.id)
    .single();
  if (!request) return { error: "Demande introuvable." };
  if (request.status === "executee") {
    return { error: "Ces actions ont déjà été exécutées." };
  }

  const { data, error } = await supabase.rpc("execute_ai_actions", {
    p_actions: parsed.data.actions,
    p_request_id: parsed.data.request_id,
    p_source: "ia",
  });

  if (error) {
    await supabase
      .from("ai_requests")
      .update({ status: "echouee", error_message: error.message })
      .eq("id", parsed.data.request_id)
      .eq("user_id", user.id);
    return { error: `Exécution annulée : ${error.message}` };
  }

  const executed = (data ?? []) as { description: string }[];

  await supabase.from("ai_messages").insert({
    user_id: user.id,
    conversation_id: parsed.data.conversation_id,
    role: "system",
    content:
      "Actions exécutées :\n" +
      executed.map((e) => `- ${e.description}`).join("\n"),
    ai_request_id: parsed.data.request_id,
  });

  await refreshConversationState(supabase, user.id, parsed.data.conversation_id);

  revalidatePath("/assistant");
  revalidatePath("/dashboard");
  revalidatePath("/taches");
  revalidatePath("/entreprises");
  return { data: { executed } };
}

/** Annule des actions proposées (aucune écriture n'a eu lieu). */
export async function cancelAiActions(
  requestId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { error } = await supabase
    .from("ai_requests")
    .update({ status: "annulee" })
    .eq("id", requestId)
    .eq("user_id", user.id);

  if (error) return { error: "Annulation impossible." };

  revalidatePath("/assistant");
  return { data: { id: requestId } };
}

/** Met à jour l'horodatage et le résumé roulant de la conversation. */
async function refreshConversationState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string
): Promise<void> {
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const all = messages ?? [];
  const dropped = all.slice(0, Math.max(0, all.length - MAX_HISTORY_MESSAGES));

  await supabase
    .from("ai_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      summary: buildRollingSummary(conversation?.summary ?? null, dropped),
    })
    .eq("id", conversationId)
    .eq("user_id", userId);
}
