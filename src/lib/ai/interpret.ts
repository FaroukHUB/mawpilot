import {
  isReadFunction,
  isWriteFunction,
  validateFunctionArguments,
} from "@/lib/ai/functions";
import { addUsage, EMPTY_USAGE, type TokenUsage } from "@/lib/ai/pricing";

/**
 * Moteur d'interprétation — indépendant d'OpenAI pour être testable.
 *
 * Boucle : on appelle le modèle ; s'il demande des LECTURES, on les exécute et
 * on lui renvoie les résultats ; s'il demande des ÉCRITURES, on ne les exécute
 * PAS : elles deviennent des propositions à confirmer par l'utilisateur.
 */

export type ModelFunctionCall = {
  callId: string;
  name: string;
  /** Arguments bruts renvoyés par le modèle (JSON sérialisé). */
  argumentsJson: string;
};

export type ModelTurn = {
  text: string;
  functionCalls: ModelFunctionCall[];
  /** Jetons consommés par cet aller-retour (pour le compteur de coût). */
  usage?: TokenUsage;
};

export type ToolResult = {
  callId: string;
  name: string;
  /** Arguments d'origine, rejoués tels quels pour la cohérence de l'échange. */
  argumentsJson: string;
  result: unknown;
};

export type ModelInput = {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  /** Résultats des lectures déjà effectuées, à renvoyer au modèle. */
  toolResults: ToolResult[];
};

export type ProposedAction = {
  name: string;
  arguments: Record<string, unknown>;
  /** Description lisible affichée à l'utilisateur avant confirmation. */
  description: string;
};

export type InterpretationResult = {
  message: string;
  proposedActions: ProposedAction[];
  /** Erreurs de validation d'arguments, à afficher honnêtement. */
  issues: string[];
  /** Jetons cumulés sur tous les allers-retours de cette demande. */
  usage: TokenUsage;
};

/** Nombre maximal d'allers-retours avec le modèle (garde-fou anti-boucle). */
export const MAX_ROUNDS = 4;

export async function runInterpretation(options: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
  callModel: (input: ModelInput) => Promise<ModelTurn>;
  executeRead: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  describeAction?: (
    name: string,
    args: Record<string, unknown>
  ) => string;
}): Promise<InterpretationResult> {
  const {
    systemPrompt,
    history,
    userMessage,
    callModel,
    executeRead,
    describeAction = defaultDescribeAction,
  } = options;

  const toolResults: ToolResult[] = [];
  const issues: string[] = [];
  let lastText = "";
  let usage: TokenUsage = EMPTY_USAGE;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const turn = await callModel({
      systemPrompt,
      history,
      userMessage,
      toolResults,
    });

    if (turn.usage) usage = addUsage(usage, turn.usage);
    if (turn.text) lastText = turn.text;

    if (turn.functionCalls.length === 0) {
      return { message: lastText, proposedActions: [], issues, usage };
    }

    const writeCalls = turn.functionCalls.filter((c) => isWriteFunction(c.name));
    const readCalls = turn.functionCalls.filter((c) => isReadFunction(c.name));
    const unknownCalls = turn.functionCalls.filter(
      (c) => !isWriteFunction(c.name) && !isReadFunction(c.name)
    );

    for (const call of unknownCalls) {
      issues.push(`Action non autorisée ignorée : ${call.name}.`);
    }

    // Les écritures arrêtent la boucle : elles doivent être confirmées.
    if (writeCalls.length > 0) {
      const proposedActions: ProposedAction[] = [];
      for (const call of writeCalls) {
        const parsedArgs = safeParseJson(call.argumentsJson);
        if (parsedArgs === null) {
          issues.push(`Arguments illisibles pour ${call.name}.`);
          continue;
        }
        const validated = validateFunctionArguments(call.name, parsedArgs);
        if (!validated.ok) {
          issues.push(`${call.name} — ${validated.error}`);
          continue;
        }
        proposedActions.push({
          name: call.name,
          arguments: validated.data,
          description: describeAction(call.name, validated.data),
        });
      }
      return { message: lastText, proposedActions, issues, usage };
    }

    // Lectures : on exécute et on renvoie les résultats au modèle.
    for (const call of readCalls) {
      const parsedArgs = safeParseJson(call.argumentsJson) ?? {};
      const validated = validateFunctionArguments(call.name, parsedArgs);
      if (!validated.ok) {
        issues.push(`${call.name} — ${validated.error}`);
        toolResults.push({
          callId: call.callId,
          name: call.name,
          argumentsJson: call.argumentsJson,
          result: { erreur: validated.error },
        });
        continue;
      }
      try {
        const result = await executeRead(call.name, validated.data);
        toolResults.push({
          callId: call.callId,
          name: call.name,
          argumentsJson: call.argumentsJson,
          result,
        });
      } catch (error) {
        toolResults.push({
          callId: call.callId,
          name: call.name,
          argumentsJson: call.argumentsJson,
          result: {
            erreur:
              error instanceof Error ? error.message : "Lecture impossible.",
          },
        });
      }
    }
  }

  issues.push(
    "L'assistant a atteint la limite d'allers-retours ; réponse partielle."
  );
  return { message: lastText, proposedActions: [], issues, usage };
}

function safeParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value || "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Description française d'une action proposée, affichée avant confirmation. */
export function defaultDescribeAction(
  name: string,
  args: Record<string, unknown>
): string {
  const s = (key: string) => (args[key] as string | undefined) ?? "";
  switch (name) {
    case "create_company":
      return `Créer l'entreprise « ${s("name")} »`;
    case "create_project":
      return `Créer le projet « ${s("name")} »`;
    case "create_task": {
      const parts = [`Créer la tâche « ${s("title")} »`];
      if (args.priority) parts.push(`priorité ${s("priority")}`);
      if (args.due_date) parts.push(`échéance ${s("due_date")}`);
      if (args.billing_status && args.billing_status !== "incluse") {
        parts.push(`facturation : ${s("billing_status")}`);
      }
      return parts.join(", ");
    }
    case "update_task":
      return `Modifier la tâche${args.status ? ` (statut : ${s("status")})` : ""}`;
    case "complete_task":
      return "Marquer la tâche comme terminée";
    case "reopen_task":
      return "Rouvrir la tâche";
    case "log_time":
      return `Enregistrer ${args.minutes} minutes${
        args.entry_date ? ` le ${s("entry_date")}` : ""
      }`;
    case "add_company_resource":
      return `Ajouter l'accès rapide « ${s("label")} » (${s("url")})`;
    case "attach_company_document":
      return `Ajouter le document « ${s("name")} »`;
    case "save_company_memory":
      return `Retenir : « ${s("content")} »`;
    case "create_reminder": {
      if (args.frequency && args.frequency !== "ponctuel") {
        const days: Record<number, string> = {
          1: "lundi",
          2: "mardi",
          3: "mercredi",
          4: "jeudi",
          5: "vendredi",
          6: "samedi",
          7: "dimanche",
        };
        const when =
          args.frequency === "hebdomadaire"
            ? `chaque ${days[Number(args.day_of_week)] ?? "semaine"}`
            : args.frequency === "mensuel"
              ? `le ${args.day_of_month} de chaque mois`
              : "chaque jour";
        return `Rappel « ${s("title")} » ${when} à ${s("time_of_day") || "09:00"}`;
      }
      return `Rappel « ${s("title")} » le ${s("run_at").replace("T", " à ")}`;
    }
    case "create_automation_rule": {
      const kinds: Record<string, string> = {
        briefing_matin: "Briefing du matin",
        compte_rendu_soir: "Compte rendu du soir",
        rapport_hebdo: "Préparation automatique du rapport",
        relance_sans_reponse: "Relance si le client ne répond pas",
        saisie_temps_manquante: "Alerte de temps non saisi",
      };
      return `Automatisation : ${kinds[s("kind")] ?? s("kind")}`;
    }
    default:
      return name;
  }
}
