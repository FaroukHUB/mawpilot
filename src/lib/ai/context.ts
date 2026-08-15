import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { APP_TIMEZONE, now } from "@/lib/dates";

/**
 * Construction du contexte envoyé au modèle (D-013).
 * On n'envoie JAMAIS tout l'historique : consigne système + résumé roulant
 * + N derniers messages + données pertinentes récupérées à la demande via
 * les fonctions de lecture.
 */

export const MAX_HISTORY_MESSAGES = 12;

export type ConversationContext = {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
};

/** Consigne système : identité, règles, contexte temporel et entreprises. */
export function buildSystemPrompt(input: {
  userName: string | null;
  companies: { id: string; name: string }[];
  companyScope: { id: string; name: string } | null;
  summary: string | null;
  memories: { content: string; category: string; status: string }[];
}): string {
  const today = now();
  const dateLine = format(today, "EEEE d MMMM yyyy", { locale: fr });

  const lines: string[] = [
    "Tu es l'assistant intégré de MAW Pilot by Farouk, une application privée de pilotage",
    "d'activité freelance. Tu réponds en français, de façon brève et concrète.",
    "",
    "CONTEXTE TEMPOREL",
    `Nous sommes le ${dateLine}. Fuseau horaire : ${APP_TIMEZONE}.`,
    `Date du jour au format ISO : ${format(today, "yyyy-MM-dd")}.`,
    "Interprète toujours les dates relatives (« vendredi », « demain »,",
    "« la semaine prochaine ») par rapport à cette date, en semaine française",
    "(lundi = premier jour). Fournis toujours les dates au format AAAA-MM-JJ.",
    "",
    "RÈGLES ABSOLUES",
    "1. Tu n'as aucun accès direct à la base : tu ne peux qu'appeler les",
    "   fonctions fournies.",
    "2. Si l'entreprise ou la tâche visée est ambiguë, DEMANDE une précision.",
    "   Ne choisis jamais au hasard.",
    "3. Tu n'inventes jamais un fait. Si une donnée n'existe pas, dis-le.",
    "4. Les actions de modification sont des PROPOSITIONS : l'utilisateur les",
    "   confirmera lui-même. Annonce clairement ce que tu proposes.",
    "5. N'utilise `save_company_memory` QUE si l'utilisateur demande",
    "   explicitement de retenir une information, ou confirme une proposition.",
    "   Jamais pour des données déjà stockées (tâches, temps, rapports,",
    "   documents) : celles-ci se consultent avec les fonctions de recherche.",
    "6. N'enregistre jamais de mot de passe, clé API ou secret.",
    "",
    "DICTÉE : EXTRAIRE TOUT, NE RIEN RÉCLAMER",
    "L'utilisateur parle souvent d'un trait, en désordre, en mélangeant",
    "plusieurs sujets. Ton travail est d'en extraire TOUTES les actions utiles",
    "en un seul tour, pas une seule.",
    "",
    "Exemple : « Aujourd'hui j'ai travaillé une heure trente sur Trust, j'ai",
    "corrigé trois produits et terminé l'article de blog » doit produire",
    "l'enregistrement du temps (90 minutes) ET la ou les tâches correspondantes",
    "— en cherchant d'abord si elles existent déjà (`search_tasks`) pour les",
    "terminer plutôt que d'en créer des doublons.",
    "",
    "NE DEMANDE JAMAIS un renseignement facultatif qui n'empêche pas d'agir.",
    "Seuls ces éléments sont réellement obligatoires :",
    "- une tâche : l'entreprise et le titre ;",
    "- du temps : l'entreprise et la durée ;",
    "- une entreprise : son nom ;",
    "- un accès rapide : le libellé et l'URL.",
    "Tout le reste (email, téléphone, forfait, couleur, catégorie, projet,",
    "montant, description) est facultatif : omets-le et propose immédiatement",
    "l'action. L'utilisateur complétera plus tard s'il le souhaite.",
    "",
    "Ne pose une question QUE si, sans la réponse, l'action est impossible ou",
    "risquerait de viser le mauvais élément (entreprise ou tâche ambiguë).",
  ];

  if (input.userName) {
    lines.push("", `L'utilisateur s'appelle ${input.userName}.`);
  }

  if (input.companyScope) {
    lines.push(
      "",
      "PÉRIMÈTRE",
      `Cette conversation concerne l'entreprise « ${input.companyScope.name} »`,
      `(company_id : ${input.companyScope.id}). Utilise cet identifiant par défaut.`
    );
  } else if (input.companies.length > 0) {
    lines.push(
      "",
      "ENTREPRISES DE L'UTILISATEUR (identifiants à utiliser tels quels)",
      ...input.companies.map((c) => `- ${c.name} : ${c.id}`)
    );
  } else {
    lines.push(
      "",
      "L'utilisateur n'a encore aucune entreprise enregistrée."
    );
  }

  if (input.memories.length > 0) {
    lines.push(
      "",
      "CONSIGNES DURABLES RETENUES",
      ...input.memories.map(
        (m) =>
          `- ${m.content}${m.status === "a_verifier" ? " (à vérifier)" : ""}`
      )
    );
  }

  if (input.summary) {
    lines.push("", "RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS", input.summary);
  }

  return lines.join("\n");
}

/** Charge le contexte d'une conversation : entreprises, souvenirs, historique. */
export async function loadConversationContext(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<ConversationContext> {
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, company_id, summary")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  const [{ data: profile }, { data: companies }, { data: messages }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).single(),
      supabase
        .from("companies")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("ai_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY_MESSAGES),
    ]);

  const companyList = companies ?? [];
  const scopeId = conversation?.company_id ?? null;
  const companyScope = scopeId
    ? (companyList.find((c) => c.id === scopeId) ?? null)
    : null;

  // Souvenirs : uniquement ceux de l'entreprise concernée (contexte ciblé).
  let memories: { content: string; category: string; status: string }[] = [];
  if (scopeId) {
    const { data } = await supabase
      .from("company_memories")
      .select("content, category, status")
      .eq("user_id", userId)
      .eq("company_id", scopeId)
      .eq("is_archived", false)
      .limit(30);
    memories = data ?? [];
  }

  const history = (messages ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return {
    systemPrompt: buildSystemPrompt({
      userName: profile?.full_name ?? null,
      companies: companyList,
      companyScope,
      summary: conversation?.summary ?? null,
      memories,
    }),
    history,
  };
}

/**
 * Résumé roulant : au-delà de `MAX_HISTORY_MESSAGES`, on condense les
 * échanges anciens pour garder le contexte sans envoyer tout l'historique.
 * Résumé factuel construit localement (aucun appel modèle supplémentaire).
 */
export function buildRollingSummary(
  previousSummary: string | null,
  droppedMessages: { role: string; content: string }[]
): string | null {
  if (droppedMessages.length === 0) return previousSummary;

  const bullets = droppedMessages
    .filter((m) => m.role === "user")
    .map((m) => `- ${m.content.replace(/\s+/g, " ").slice(0, 200)}`);

  if (bullets.length === 0) return previousSummary;

  const parts = [previousSummary, ...bullets].filter(Boolean) as string[];
  const summary = parts.join("\n");

  // Borne de sécurité : le résumé ne doit pas gonfler indéfiniment.
  return summary.length > 4000 ? summary.slice(-4000) : summary;
}
