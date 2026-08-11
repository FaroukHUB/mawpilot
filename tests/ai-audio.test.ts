import { describe, expect, it } from "vitest";

import {
  audioFileName,
  isAllowedAudioMimeType,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  normalizeAudioMimeType,
  validateAudioUpload,
} from "@/lib/ai/audio";
import { computeTranscriptionCost, DEFAULT_RATES } from "@/lib/ai/pricing";

describe("normalizeAudioMimeType", () => {
  it("retire le suffixe de codec ajouté par MediaRecorder", () => {
    expect(normalizeAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMimeType("AUDIO/MP4")).toBe("audio/mp4");
  });
});

describe("isAllowedAudioMimeType", () => {
  it("accepte les formats produits par les navigateurs courants", () => {
    for (const type of [
      "audio/webm;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/wav",
    ]) {
      expect(isAllowedAudioMimeType(type)).toBe(true);
    }
  });

  it("refuse tout ce qui n'est pas de l'audio", () => {
    for (const type of [
      "video/mp4",
      "application/pdf",
      "text/html",
      "application/x-msdownload",
      "",
    ]) {
      expect(isAllowedAudioMimeType(type)).toBe(false);
    }
  });
});

describe("validateAudioUpload", () => {
  const valid = {
    mimeType: "audio/webm;codecs=opus",
    sizeBytes: 120_000,
    durationSeconds: 12,
  };

  it("accepte un enregistrement normal et normalise le type", () => {
    const result = validateAudioUpload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mimeType).toBe("audio/webm");
  });

  it("refuse un enregistrement vide", () => {
    const result = validateAudioUpload({ ...valid, sizeBytes: 0 });
    expect(result.ok).toBe(false);
  });

  it("refuse un fichier trop volumineux", () => {
    const result = validateAudioUpload({
      ...valid,
      sizeBytes: MAX_AUDIO_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("10 Mo");
  });

  it("refuse une dictée trop longue", () => {
    const result = validateAudioUpload({
      ...valid,
      durationSeconds: MAX_AUDIO_SECONDS + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("5 minutes");
  });

  it("refuse un fichier déguisé en audio", () => {
    const result = validateAudioUpload({
      ...valid,
      mimeType: "application/x-msdownload",
    });
    expect(result.ok).toBe(false);
  });

  it("accepte exactement la limite de durée", () => {
    expect(
      validateAudioUpload({ ...valid, durationSeconds: MAX_AUDIO_SECONDS }).ok
    ).toBe(true);
  });
});

describe("audioFileName", () => {
  it("donne une extension cohérente avec le type", () => {
    expect(audioFileName("audio/webm;codecs=opus")).toBe("audio.webm");
    expect(audioFileName("audio/mp4")).toBe("audio.mp4");
    expect(audioFileName("audio/x-wav")).toBe("audio.wav");
  });

  it("retombe sur webm pour un type inconnu", () => {
    expect(audioFileName("audio/inconnu")).toBe("audio.webm");
  });
});

describe("computeTranscriptionCost", () => {
  it("facture à la durée d'audio", () => {
    expect(computeTranscriptionCost(60, DEFAULT_RATES)).toBeCloseTo(
      DEFAULT_RATES.transcriptionPerMinute,
      9
    );
    expect(computeTranscriptionCost(30, DEFAULT_RATES)).toBeCloseTo(
      DEFAULT_RATES.transcriptionPerMinute / 2,
      9
    );
  });

  it("ne coûte rien pour une durée nulle ou négative", () => {
    expect(computeTranscriptionCost(0, DEFAULT_RATES)).toBe(0);
    expect(computeTranscriptionCost(-10, DEFAULT_RATES)).toBe(0);
  });

  it("utilise le tarif configuré", () => {
    const cost = computeTranscriptionCost(120, {
      ...DEFAULT_RATES,
      transcriptionPerMinute: 0.5,
    });
    expect(cost).toBeCloseTo(1, 9);
  });
});
