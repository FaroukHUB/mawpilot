import { NextResponse, type NextRequest } from "next/server";

import { audioFileName, validateAudioUpload } from "@/lib/ai/audio";
import { loadBudgetSettings } from "@/lib/ai/budget";
import {
  getOpenAIClient,
  getTranscriptionModel,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { computeTranscriptionCost, formatUsd } from "@/lib/ai/pricing";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Transcription d'un court enregistrement.
 *
 * La clé OpenAI reste côté serveur : le navigateur n'envoie que l'audio.
 * Le résultat est affiché à l'utilisateur pour correction AVANT toute
 * interprétation — jamais d'action déclenchée directement par la voix.
 */
export async function POST(request: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        error:
          "Transcription indisponible : ajoutez OPENAI_API_KEY dans .env.local.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const rate = await checkAiRateLimit(supabase, user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: rate.message }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const file = formData.get("audio");
  const durationSeconds = Number(formData.get("duration") ?? 0);

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Aucun enregistrement reçu." },
      { status: 400 }
    );
  }

  const validation = validateAudioUpload({
    mimeType: file.type,
    sizeBytes: file.size,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const settings = await loadBudgetSettings(supabase, user.id);
  const costUsd = computeTranscriptionCost(durationSeconds, settings.rates);

  // Garde-fou budget : on ne dépense pas au-delà du crédit déclaré.
  if (settings.creditUsd > 0) {
    const { data: spentRows } = await supabase
      .from("ai_requests")
      .select("cost_usd")
      .eq("user_id", user.id)
      .gte("created_at", settings.creditSince);
    const spent = (spentRows ?? []).reduce(
      (s, r) => s + Number(r.cost_usd ?? 0),
      0
    );
    if (spent >= settings.creditUsd) {
      return NextResponse.json(
        {
          error:
            "Crédit IA épuisé d'après votre compteur. Rechargez puis mettez à jour le montant dans Paramètres.",
        },
        { status: 402 }
      );
    }
  }

  try {
    const client = getOpenAIClient();
    const audioFile = new File([await file.arrayBuffer()], audioFileName(file.type), {
      type: validation.mimeType,
    });

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: getTranscriptionModel(),
      language: "fr",
    });

    const text = transcription.text?.trim() ?? "";

    // Trace la dépense pour le compteur de budget.
    await supabase.from("ai_requests").insert({
      user_id: user.id,
      user_message: text || "(transcription vide)",
      input_mode: "ia_voix",
      intent: "transcription",
      status: "executee",
      model: getTranscriptionModel(),
      cost_usd: costUsd,
    });

    return NextResponse.json({
      text,
      costUsd,
      costLabel: formatUsd(costUsd),
      durationSeconds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription impossible.";
    return NextResponse.json(
      { error: `Transcription impossible : ${message}` },
      { status: 502 }
    );
  }
}
