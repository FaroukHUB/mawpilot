import { NextResponse, type NextRequest } from "next/server";

import { audioFileName, validateAudioUpload } from "@/lib/ai/audio";
import { loadBudgetSettings } from "@/lib/ai/budget";
import {
  getOpenAIClient,
  getTranscriptionModel,
  isOpenAIConfigured,
} from "@/lib/ai/openai";
import { computeTranscriptionCost } from "@/lib/ai/pricing";
import { openPortalSession } from "@/lib/client-portal/data";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transcription pour le portail client — authentifiée par jeton, sans session.
 *
 * Contraintes plus strictes que côté propriétaire : la dictée d'un client est
 * courte par nature, et son coût est imputé au budget du prestataire.
 */

export const runtime = "nodejs";

/** Une dictée client dépasse rarement une minute. */
const MAX_CLIENT_AUDIO_SECONDS = 120;
/** Anti-abus : nombre de dictées par heure et par entreprise. */
const MAX_TRANSCRIPTIONS_PER_HOUR = 15;

export async function POST(request: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "Dictée indisponible pour le moment." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const token = String(formData.get("token") ?? "");
  const session = await openPortalSession(token);
  if (!session || !session.settings.voiceEnabled) {
    return NextResponse.json(
      { error: "Ce lien n'est plus valide." },
      { status: 401 }
    );
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
  if (durationSeconds > MAX_CLIENT_AUDIO_SECONDS) {
    return NextResponse.json(
      { error: "Message trop long (2 minutes maximum)." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Anti-abus : compte les dictées de cette entreprise dans l'heure.
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", session.companyId)
    .eq("is_voice", true)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_TRANSCRIPTIONS_PER_HOUR) {
    return NextResponse.json(
      { error: "Trop de messages vocaux envoyés. Merci de patienter." },
      { status: 429 }
    );
  }

  try {
    const client = getOpenAIClient();
    const audioFile = new File(
      [await file.arrayBuffer()],
      audioFileName(file.type),
      { type: validation.mimeType }
    );

    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: getTranscriptionModel(),
      language: "fr",
    });

    const text = transcription.text?.trim() ?? "";

    // Le coût est imputé au budget du prestataire, et visible dans son
    // compteur : il ne doit pas le découvrir sur sa facture.
    const settings = await loadBudgetSettings(supabase, session.userId);
    await supabase.from("ai_requests").insert({
      user_id: session.userId,
      user_message: `[dictée client — ${session.companyName}] ${text.slice(0, 300)}`,
      input_mode: "ia_voix",
      intent: "transcription_client",
      status: "executee",
      model: getTranscriptionModel(),
      cost_usd: computeTranscriptionCost(durationSeconds, settings.rates),
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Transcription portail client :", error);
    return NextResponse.json(
      { error: "Transcription impossible. Écrivez votre message." },
      { status: 502 }
    );
  }
}
