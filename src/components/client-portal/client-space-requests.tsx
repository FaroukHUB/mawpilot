"use client";

import * as React from "react";
import { CheckCircle2, Clock, Loader2, Send } from "lucide-react";

import { submitSpaceRequest } from "@/actions/client-space";
import { VoiceRecorder } from "@/components/assistant/voice-recorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ClientRequestItem } from "@/lib/client-portal/client-data";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  nouvelle: { label: "Reçue", className: "bg-secondary text-secondary-foreground" },
  en_analyse: { label: "En cours d'étude", className: "bg-secondary text-secondary-foreground" },
  acceptee: { label: "Planifiée", className: "bg-emerald-100 text-emerald-900" },
  hors_forfait: { label: "À chiffrer", className: "bg-brand-orange/20 text-orange-900" },
  refusee: { label: "Non retenue", className: "bg-muted text-muted-foreground" },
  archivee: { label: "Clôturée", className: "bg-muted text-muted-foreground" },
};

export function ClientSpaceRequests({
  requests,
  voiceEnabled,
}: {
  requests: ClientRequestItem[];
  voiceEnabled: boolean;
}) {
  const [items, setItems] = React.useState(
    Array.isArray(requests) ? requests : []
  );
  const [text, setText] = React.useState("");
  const [isVoice, setIsVoice] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function send() {
    const message = text.trim();
    if (!message) return;
    setError(null);
    setNotice(null);
    setReply(null);

    startTransition(async () => {
      const result = await submitSpaceRequest({
        message,
        is_voice: isVoice,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Envoi impossible.");
        return;
      }
      setItems((prev) => [
        {
          id: result.data.requestId,
          content: message,
          status: "en_analyse",
          createdOn: "à l'instant",
          promisedDate: null,
          reply: result.data.reply,
        },
        ...prev,
      ]);
      setReply(result.data.reply);
      setText("");
      setIsVoice(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Déposer une demande</CardTitle>
          <CardDescription>
            Écrivez ou dictez : votre message arrive directement, et vous
            suivez son avancement ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
          {reply ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {reply}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Vos demandes ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Vous n&apos;avez pas encore déposé de demande.
            </p>
          ) : (
            items.map((item) => {
              const status = STATUS_LABELS[item.status] ?? {
                label: item.status,
                className: "bg-secondary text-secondary-foreground",
              };
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">
                      {item.content}
                    </p>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden />
                    {item.createdOn}
                    {item.promisedDate ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="size-3" aria-hidden />
                        Prévu le {item.promisedDate}
                      </span>
                    ) : null}
                  </p>

                  {item.reply ? (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs">
                      {item.reply}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
