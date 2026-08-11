import OpenAI from "openai";

/**
 * Client OpenAI — SERVEUR UNIQUEMENT.
 * La clé n'est jamais exposée au navigateur (aucune variable NEXT_PUBLIC_*).
 */

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY absente. Ajoutez-la dans .env.local (jamais dans le dépôt)."
    );
  }
  client ??= new OpenAI({ apiKey });
  return client;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Modèle texte, configurable par variable d'environnement. */
export function getTextModel(): string {
  return process.env.OPENAI_TEXT_MODEL || "gpt-5";
}

/** Modèle de transcription, configurable (phase 7). */
export function getTranscriptionModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe";
}
