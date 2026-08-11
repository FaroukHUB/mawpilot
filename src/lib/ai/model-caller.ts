import { buildToolDefinitions } from "@/lib/ai/functions";
import { getOpenAIClient, getTextModel } from "@/lib/ai/openai";
import type { ModelInput, ModelTurn } from "@/lib/ai/interpret";

/**
 * Appel réel à la Responses API d'OpenAI.
 *
 * `store: false` (D-015) : OpenAI ne conserve rien. Tout le contexte est
 * reconstruit à chaque appel depuis Supabase, notre source de vérité.
 * L'ancienne Assistants API n'est jamais utilisée.
 */
export async function callOpenAIModel(input: ModelInput): Promise<ModelTurn> {
  const client = getOpenAIClient();

  type InputItem = Record<string, unknown>;
  const items: InputItem[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.userMessage },
  ];

  // Résultats des lectures déjà effectuées : on rejoue l'appel puis sa sortie.
  for (const result of input.toolResults) {
    items.push({
      type: "function_call",
      call_id: result.callId,
      name: result.name,
      arguments: result.argumentsJson,
    });
    items.push({
      type: "function_call_output",
      call_id: result.callId,
      output: JSON.stringify(result.result).slice(0, 12000),
    });
  }

  const response = await client.responses.create({
    model: getTextModel(),
    instructions: input.systemPrompt,
    input: items as never,
    tools: buildToolDefinitions() as never,
    store: false,
  });

  const functionCalls: ModelTurn["functionCalls"] = [];
  for (const item of response.output ?? []) {
    if (item.type === "function_call") {
      functionCalls.push({
        callId: item.call_id,
        name: item.name,
        argumentsJson: item.arguments ?? "{}",
      });
    }
  }

  return {
    text: response.output_text ?? "",
    functionCalls,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      cachedInputTokens:
        response.usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}
