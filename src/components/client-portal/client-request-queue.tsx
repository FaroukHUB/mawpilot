"use client";

import * as React from "react";
import {
  Archive,
  Check,
  FileText,
  ImageIcon,
  Loader2,
  MailCheck,
  Mic,
  Send,
  X,
} from "lucide-react";

import {
  acceptClientRequest,
  replyToClientRequest,
  setRequestStatus,
} from "@/actions/client-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/dates";

export type RequestAttachment = {
  id: string;
  name: string;
  url: string | null;
  isImage: boolean;
};

export type ClientRequestRow = {
  id: string;
  content: string;
  contact_name: string | null;
  classification: string;
  status: string;
  assistant_reply: string | null;
  owner_reply: string | null;
  promised_date: string | null;
  is_voice: boolean;
  created_at: string;
  companies: { name: string; color: string } | null;
  attachments: RequestAttachment[];
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  incluse: "Incluse au forfait",
  supplementaire: "Hors forfait",
  question: "Question",
  indeterminee: "À classer",
};

const STATUS_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_analyse: "À traiter",
  acceptee: "Acceptée",
  hors_forfait: "Hors forfait",
  refusee: "Refusée",
  archivee: "Archivée",
};

export function ClientRequestQueue({
  requests,
  readOnly = false,
}: {
  requests: ClientRequestRow[];
  readOnly?: boolean;
}) {
  const list = Array.isArray(requests) ? requests : [];

  return (
    <div className="flex flex-col gap-3">
      {list.map((request) => (
        <RequestCard key={request.id} request={request} readOnly={readOnly} />
      ))}
    </div>
  );
}

function RequestCard({
  request,
  readOnly,
}: {
  request: ClientRequestRow;
  readOnly: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(request.content.slice(0, 120));
  const [promisedDate, setPromisedDate] = React.useState("");
  const [billing, setBilling] = React.useState(
    request.classification === "supplementaire" ? "a_facturer" : "incluse"
  );
  const [reply, setReply] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptClientRequest({
        request_id: request.id,
        title,
        promised_date: promisedDate,
        billing_status: billing,
        reply,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-start gap-2">
        {request.companies ? (
          <span
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: request.companies.color }}
            aria-hidden
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm whitespace-pre-wrap">{request.content}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {request.companies?.name}
            {request.contact_name ? ` · ${request.contact_name}` : ""} ·{" "}
            {formatDateTime(request.created_at)}
            {request.is_voice ? " · dictée" : ""}
          </p>
        </div>
        {request.is_voice ? (
          <Mic className="size-3.5 text-muted-foreground" aria-label="Dictée" />
        ) : null}
        <Badge
          className={
            request.classification === "supplementaire"
              ? "bg-brand-orange/20 text-orange-900"
              : "bg-secondary text-secondary-foreground"
          }
        >
          {CLASSIFICATION_LABELS[request.classification] ??
            request.classification}
        </Badge>
        <Badge variant="secondary">
          {STATUS_LABELS[request.status] ?? request.status}
        </Badge>
        {request.owner_reply ? (
          <Badge className="bg-emerald-600 text-white">
            <MailCheck className="size-3" aria-hidden />
            Répondu
          </Badge>
        ) : null}
      </div>

      {request.attachments?.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {request.attachments.map((file) => (
            <li key={file.id}>
              <a
                href={file.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:underline"
              >
                {file.isImage ? (
                  <ImageIcon className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                )}
                <span className="max-w-48 truncate">{file.name}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {request.owner_reply ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <strong>Votre réponse :</strong> {request.owner_reply}
        </p>
      ) : null}

      {request.assistant_reply ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <strong>Réponse déjà envoyée au client :</strong>{" "}
          {request.assistant_reply}
        </p>
      ) : null}

      {request.promised_date ? (
        <p className="text-xs font-medium text-emerald-700">
          Date communiquée au client : {request.promised_date}
        </p>
      ) : null}

      {readOnly ? null : open ? (
        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`title-${request.id}`}>Titre de la tâche</Label>
            <Input
              id={`title-${request.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`date-${request.id}`}>
                Date annoncée au client
              </Label>
              <Input
                id={`date-${request.id}`}
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour ne rien promettre.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`billing-${request.id}`}>Facturation</Label>
              <Select
                id={`billing-${request.id}`}
                value={billing}
                onChange={(e) => setBilling(e.target.value)}
              >
                <option value="incluse">Incluse au forfait</option>
                <option value="supplementaire">Supplémentaire</option>
                <option value="a_facturer">À facturer</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`reply-${request.id}`}>Message au client</Label>
            <Textarea
              id={`reply-${request.id}`}
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Laissez vide pour un accusé de réception standard."
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={accept} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              Créer la tâche et répondre
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Check aria-hidden />
            Accepter
          </Button>
          <ReplyBox requestId={request.id} />
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setRequestStatus(request.id, "refusee");
              })
            }
          >
            <X aria-hidden />
            Refuser
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setRequestStatus(request.id, "archivee");
              })
            }
          >
            <Archive aria-hidden />
            Archiver
          </Button>
        </div>
      )}
    </div>
  );
}

function ReplyBox({ requestId }: { requestId: string }) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Send aria-hidden />
        Répondre
      </Button>
    );
  }

  return (
    <div className="flex w-full gap-2">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Votre réponse au client…"
        aria-label="Réponse au client"
      />
      <Button
        size="sm"
        disabled={isPending || message.trim() === ""}
        onClick={() =>
          startTransition(async () => {
            await replyToClientRequest(requestId, message);
            setMessage("");
            setOpen(false);
          })
        }
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Envoyer
      </Button>
    </div>
  );
}
