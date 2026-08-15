"use client";

import { CheckCircle2, Clock, MessagesSquare } from "lucide-react";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessagesSquare className="size-4" aria-hidden />
          Vos demandes ({items.length})
        </CardTitle>
        <CardDescription>
          Tout ce que vous avez demandé, et où ça en est.
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
                className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap">
                    {item.content}
                  </p>
                  <Badge className={status.className}>{status.label}</Badge>
                </div>

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
  );
}
