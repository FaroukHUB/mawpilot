"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  ImageIcon,
  MailCheck,
  MessagesSquare,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClientRequestItem } from "@/lib/client-portal/client-data";

/**
 * Suivi des demandes déposées par le client.
 * Le dépôt se fait dans la conversation : cet écran ne fait que rendre
 * compte, statut par statut.
 */

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  nouvelle: {
    label: "Reçue",
    className: "bg-secondary text-secondary-foreground",
  },
  en_analyse: {
    label: "En cours d'étude",
    className: "bg-secondary text-secondary-foreground",
  },
  acceptee: { label: "Planifiée", className: "bg-emerald-100 text-emerald-900" },
  hors_forfait: {
    label: "À chiffrer",
    className: "bg-brand-orange/20 text-orange-900",
  },
  refusee: { label: "Non retenue", className: "bg-muted text-muted-foreground" },
  archivee: { label: "Clôturée", className: "bg-muted text-muted-foreground" },
};

export function ClientSpaceRequests({
  requests,
}: {
  requests: ClientRequestItem[];
}) {
  const items = Array.isArray(requests) ? requests : [];
  const answered = items.filter((item) => item.ownerReply !== null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="size-4" aria-hidden />
          Vos demandes ({items.length})
        </CardTitle>
        <CardDescription>
          Tout ce que vous avez demandé, et où ça en est.
          {answered > 0
            ? ` ${answered} ${answered > 1 ? "ont" : "a"} reçu une réponse.`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune demande pour l&apos;instant. Formulez-la dans l&apos;onglet
            « Assistant » : elle apparaîtra ici automatiquement.
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
                className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 ${
                  item.ownerReply ? "border-emerald-300 bg-emerald-50/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">
                    {item.content}
                  </p>
                  {item.ownerReply ? (
                    <Badge className="bg-emerald-600 text-white">
                      <MailCheck className="size-3" aria-hidden />
                      Réponse obtenue
                    </Badge>
                  ) : null}
                  <Badge className={status.className}>{status.label}</Badge>
                </div>

                {item.attachments.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {item.attachments.map((file) => {
                      const icon = file.isImage ? (
                        <ImageIcon className="size-3 shrink-0" aria-hidden />
                      ) : (
                        <FileText className="size-3 shrink-0" aria-hidden />
                      );
                      return (
                        <li key={file.id}>
                          {file.url ? (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs hover:underline"
                            >
                              {icon}
                              <span className="max-w-40 truncate">
                                {file.name}
                              </span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs">
                              {icon}
                              <span className="max-w-40 truncate">
                                {file.name}
                              </span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3" aria-hidden />
                  {item.createdOn}
                  {item.promisedDate ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                      <CheckCircle2 className="size-3" aria-hidden />
                      Prévu le {item.promisedDate}
                    </span>
                  ) : null}
                </p>

                {item.ownerReply ? (
                  <div className="rounded-md border border-emerald-300 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold tracking-wide text-emerald-800 uppercase">
                      Réponse de votre prestataire
                      {item.ownerRepliedOn ? ` · ${item.ownerRepliedOn}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">
                      {item.ownerReply}
                    </p>
                  </div>
                ) : item.reply ? (
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
  );
}
