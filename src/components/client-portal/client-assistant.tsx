"use client";

import * as React from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

import { sendSpaceMessage } from "@/actions/client-space";
import { VoiceRecorder } from "@/components/assistant/voice-recorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientMessage } from "@/lib/client-portal/client-data";
import { cn } from "@/lib/utils";

/**
 * Conversation du client avec l'assistant.
 *
 * C'est l'entrée principale de l'espace : le client parle, l'assistant répond
 * et range. Il n'a jamais à choisir entre « question » et « demande ».
 */

const SUGGESTIONS = [
  "Où en est mon projet ?",
  "Qu'est-ce qui attend une réponse de ma part ?",
  "J'aimerais ajouter une page au site",
  "Qu'est-ce qui est prévu ensuite ?",
];

export function ClientAssistant({
  messages,
  voiceEnabled,
  firstName,
}: {
  messages: ClientMessage[];
  voiceEnabled: boolean;
  firstName: string;
}) {
  const [items, setItems] = React.useState<ClientMessage[]>(
    Array.isArray(messages) ? messages : []
  );
  const [text, setText] = React.useState("");
  const [isVoice, setIsVoice] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items.length, isPending]);

  function send(raw?: string) {
    const message = (raw ?? text).trim();
    if (!message || isPending) return;
    setError(null);
    setNotice(null);

    const localId = `local-${items.length}`;
    setItems((prev) => [
      ...prev,
      { id: localId, author: "client", content: message, createdOn: "" },
    ]);
    setText("");

    startTransition(async () => {
      const result = await sendSpaceMessage({ message, is_voice: isVoice });
      setIsVoice(false);

      if (result.error || !result.data) {
        setError(result.error ?? "Envoi impossible.");
        setItems((prev) => prev.filter((m) => m.id !== localId));
        setText(message);
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          id: `${localId}-reply`,
          author: "assistant",
          content: result.data.reply,
          createdOn: "",
        },
      ]);
      if (result.data.requestCreated) {
        setNotice(
          result.data.outOfScope
            ? "Votre demande est transmise pour étude."
            : "C'est noté : votre demande est ajoutée au suivi."
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-[18rem] flex-col gap-3 rounded-xl border bg-card p-4">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <p className="font-medium">Bonjour {firstName}, je vous écoute.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Posez une question sur l&apos;avancement, ou formulez une
              demande : je la transmets et vous la suivez ensuite dans
              « Mes demandes ».
            </p>
          </div>
        ) : (
          <div
            className="flex flex-col gap-3"
            role="log"
            aria-live="polite"
            aria-label="Conversation"
          >
            {items.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.author === "client" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                    message.author === "client"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted"
                  )}
                >
                  {message.content}
                  {message.createdOn ? (
                    <span
                      className={cn(
                        "mt-1 block text-[11px]",
                        message.author === "client"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {message.createdOn}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {isPending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Un instant…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isPending}
              onClick={() => send(suggestion)}
              className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {notice ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Écrivez votre message… (Entrée pour envoyer)"
          aria-label="Votre message"
          disabled={isPending}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => send()} disabled={isPending || !text.trim()}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            Envoyer
          </Button>

          {voiceEnabled ? (
            <VoiceRecorder
              label="Dicter"
              disabled={isPending}
              onError={(message) => setError(message)}
              onTranscribed={({ text: transcribed }) => {
                setError(null);
                setIsVoice(true);
                setText((prev) =>
                  prev.trim() ? `${prev.trim()} ${transcribed}` : transcribed
                );
                setNotice("Transcription ajoutée — relisez avant d'envoyer.");
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
