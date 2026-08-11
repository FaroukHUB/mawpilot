"use client";

import * as React from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_AUDIO_SECONDS } from "@/lib/ai/audio";
import { cn } from "@/lib/utils";

export type TranscriptionResult = {
  text: string;
  costLabel: string;
  durationSeconds: number;
};

/**
 * Bouton microphone : enregistre un court audio, l'envoie à la route serveur
 * de transcription et rend le texte au parent — qui l'affiche pour correction.
 * Aucune action n'est jamais déclenchée directement par la voix.
 */
export function VoiceRecorder({
  onTranscribed,
  onError,
  disabled = false,
  label = "Dicter",
}: {
  onTranscribed: (result: TranscriptionResult) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = React.useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  React.useEffect(() => {
    return () => {
      stopTimer();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimer]);

  async function startRecording() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError(
        "Votre navigateur ne permet pas l'enregistrement audio. Utilisez la saisie texte."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError(
        "Accès au micro refusé. Autorisez le microphone dans votre navigateur."
      );
      return;
    }

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      stopTimer();
      setIsRecording(false);
      stream.getTracks().forEach((t) => t.stop());

      const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });

      if (blob.size === 0 || durationSeconds < 0.4) {
        onError("Enregistrement trop court.");
        return;
      }

      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "dictee");
        formData.append("duration", String(durationSeconds));

        const response = await fetch("/api/ai/transcribe", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok) {
          onError(payload.error ?? "Transcription impossible.");
          return;
        }
        if (!payload.text) {
          onError("Rien n'a été compris. Réessayez en parlant plus près du micro.");
          return;
        }
        onTranscribed({
          text: payload.text,
          costLabel: payload.costLabel ?? "",
          durationSeconds,
        });
      } catch {
        onError("Transcription impossible : vérifiez votre connexion.");
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.start();
    setIsRecording(true);
    setSeconds(0);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(elapsed);
      // Arrêt automatique à la limite, pour ne pas dépasser le quota.
      if (elapsed >= MAX_AUDIO_SECONDS) stopRecording();
    }, 250);
  }

  const busy = disabled || isTranscribing;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={busy}
        aria-label={
          isRecording
            ? "Arrêter l'enregistrement"
            : `${label} — enregistrer un message vocal`
        }
        aria-pressed={isRecording}
        className={cn(
          "gap-2",
          isRecording && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        )}
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : isRecording ? (
          <Square aria-hidden />
        ) : (
          <Mic aria-hidden />
        )}
        {isTranscribing
          ? "Transcription…"
          : isRecording
            ? `Arrêter (${formatSeconds(seconds)})`
            : label}
      </Button>

      {isRecording ? (
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          role="status"
        >
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          Enregistrement en cours
        </span>
      ) : null}
    </div>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
