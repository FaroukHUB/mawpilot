/**
 * Contraintes sur les enregistrements audio envoyés à la transcription.
 * Limiter type et taille est une exigence de sécurité : on ne laisse pas
 * envoyer n'importe quel fichier à une API payante.
 */

/** 10 Mo : largement suffisant pour une dictée de quelques minutes. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** 5 minutes : au-delà, mieux vaut découper la dictée. */
export const MAX_AUDIO_SECONDS = 300;

/** Types produits par MediaRecorder selon les navigateurs. */
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/flac",
] as const;

/** Un type MediaRecorder peut porter un suffixe : « audio/webm;codecs=opus ». */
export function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedAudioMimeType(mimeType: string): boolean {
  return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(
    normalizeAudioMimeType(mimeType)
  );
}

export type AudioValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; error: string };

export function validateAudioUpload(input: {
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
}): AudioValidationResult {
  if (input.sizeBytes <= 0) {
    return { ok: false, error: "Enregistrement vide." };
  }
  if (input.sizeBytes > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      error: "Enregistrement trop volumineux (10 Mo maximum).",
    };
  }
  if (!isAllowedAudioMimeType(input.mimeType)) {
    return {
      ok: false,
      error: `Format audio non autorisé (${input.mimeType || "inconnu"}).`,
    };
  }
  if (input.durationSeconds > MAX_AUDIO_SECONDS) {
    return {
      ok: false,
      error: "Dictée trop longue (5 minutes maximum). Découpez-la.",
    };
  }
  return { ok: true, mimeType: normalizeAudioMimeType(input.mimeType) };
}

/** Extension de fichier attendue par l'API selon le type MIME. */
export function audioFileName(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "audio.webm",
    "audio/ogg": "audio.ogg",
    "audio/mp4": "audio.mp4",
    "audio/mpeg": "audio.mp3",
    "audio/wav": "audio.wav",
    "audio/x-wav": "audio.wav",
    "audio/aac": "audio.aac",
    "audio/flac": "audio.flac",
  };
  return map[normalizeAudioMimeType(mimeType)] ?? "audio.webm";
}
