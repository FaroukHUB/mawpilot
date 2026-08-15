"use client";

import * as React from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";

import { submitClientRequest } from "@/actions/client-portal";
import { VoiceRecorder } from "@/components/assistant/voice-recorder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  author: "client" | "assistant" | "utilisateur";
  content: string;
};

/**
 * Espace de demande du client : il écrit ou dicte, l'assistant accuse
 * réception et classe. Aucune date n'est jamais annoncée ici — seul le
 * prestataire s'engage, depuis son application.
 */
export function ClientRequestPanel({
  token,
  messages: initialMessages,
  voiceEnabled,
}: {
  token: string;
  messages: Message[];
  voiceEnabled: boolean;
}) {
  const [messages, setMessages] = React.useState<Message[]>(
    Array.isArray(initialMessages) ? initialMessages : []
  );
  const [text, setText] = React.useState("");
  const [rawTranscription, setRawTranscription] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function send() {
    const message = text.trim();
    if (!message) return;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await submitClientRequest({
        token,
        message,
        is_voice: rawTranscription !== "",
        raw_transcription: rawTranscription || undefined,
      });

      if (result.error || !result.data) {
        setError(result.error ?? "Envoi impossible.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, author: "client", content: message },
        {
          id: result.data.requestId,
          author: "assistant",
          content: result.data.reply,
        },
      ]);
      setText("");
      setRawTranscription("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" aria-hidden />
          Une demande, une question ?
        </CardTitle>
        <CardDescription>
          Écrivez ou dictez : votre message est transmis directement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {messages.length > 0 ? (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  message.author === "client"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start border bg-card"
                )}
              >
                {message.content}
              </div>
            ))}
          </div>
        ) : null}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Par exemple : pouvez-vous mettre à jour les horaires sur le site ?"
          aria-label="Votre demande"
          disabled={isPending}
        />

        {notice ? (
          <p className="text-xs text-muted-foreground">{notice}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={send} disabled={isPending || text.trim() === ""}>
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
              endpoint="/api/client/transcribe"
              extraFields={{ token }}
              onError={(message) => setError(message)}
              onTranscribed={({ text: transcribed }) => {
                setError(null);
                setRawTranscription((prev) =>
                  prev ? `${prev}\n${transcribed}` : transcribed
                );
                setText((prev) =>
                  prev.trim() ? `${prev.trim()} ${transcribed}` : transcribed
                );
                setNotice(
                  "Transcription ajoutée — relisez-la avant d'envoyer."
                );
              }}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
