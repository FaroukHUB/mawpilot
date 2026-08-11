"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Share2,
} from "lucide-react";

import { confirmDeliverySent, prepareDelivery } from "@/actions/reports";
import type { ChannelRow } from "@/components/contacts/channel-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/dates";
import { buildWhatsAppLink, formatPhoneForDisplay } from "@/lib/whatsapp";
import { channelTypeLabels } from "@/lib/validations/contacts";
import { deliveryMethodLabels } from "@/lib/validations/reports";

type Delivery = {
  id: string;
  destination_label: string;
  method: string;
  status: string;
  delivered_at: string | null;
  created_at: string;
};

/**
 * Partage assisté manuel — jamais d'envoi automatique.
 * Le rapport n'est marqué « envoyé » qu'après confirmation explicite.
 */
export function ReportSharePanel({
  reportId,
  message,
  channels,
  deliveries,
  onBeforeShare,
}: {
  reportId: string;
  message: string;
  channels: ChannelRow[];
  deliveries: Delivery[];
  onBeforeShare?: () => void;
}) {
  const activeChannels = channels.filter((c) => c.is_active);
  const defaultChannel = activeChannels.find((c) => c.is_default);
  const [channelId, setChannelId] = React.useState(
    defaultChannel?.id ?? activeChannels[0]?.id ?? ""
  );
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Le partage natif n'existe pas au rendu serveur : on interroge le
  // navigateur sans provoquer d'écart d'hydratation.
  const canShareFiles = React.useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && "share" in navigator,
    () => false
  );

  const channel = activeChannels.find((c) => c.id === channelId);
  const waLink =
    channel?.type === "whatsapp_direct" && channel.phone_number
      ? buildWhatsAppLink(channel.phone_number, message)
      : null;

  function logPreparation(method: string) {
    onBeforeShare?.();
    startTransition(async () => {
      const result = await prepareDelivery({
        report_id: reportId,
        company_channel_id: channelId || "",
        destination_label: channel?.label ?? "Destination libre",
        method,
        prepared_content: message,
      });
      if (result.error) setError(result.error);
    });
  }

  async function copyMessage() {
    setError(null);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      logPreparation("copier_coller");
    } catch {
      setError(
        "Copie impossible. Sélectionnez le texte du message et copiez-le manuellement."
      );
    }
  }

  async function nativeShare() {
    setError(null);
    try {
      await navigator.share({ text: message });
      logPreparation("partage_natif");
    } catch {
      // L'utilisateur a annulé le partage : rien à signaler.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="size-4" aria-hidden />
          Partager le rapport
        </CardTitle>
        <CardDescription>
          L&apos;application prépare le message ; c&apos;est vous qui
          l&apos;envoyez, puis qui confirmez l&apos;envoi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activeChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune destination enregistrée. Ajoutez-en une dans l&apos;onglet
            « Contacts & WhatsApp » de la fiche entreprise.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="share-channel" className="text-sm font-medium">
              Destination
            </label>
            <Select
              id="share-channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {activeChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {channelTypeLabels[c.type]}
                  {c.is_default ? " (par défaut)" : ""}
                </option>
              ))}
            </Select>
          </div>
        )}

        {channel?.type === "whatsapp_groupe" ? (
          <p className="flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Groupe « {channel.group_name} » : WhatsApp ne permet pas de
              l&apos;ouvrir automatiquement. Copiez le message ou utilisez le
              partage, puis sélectionnez le groupe vous-même.
            </span>
          </p>
        ) : null}

        {channel?.instructions ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {channel.instructions}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={copyMessage} disabled={isPending}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Message copié" : "Copier le message"}
          </Button>

          {waLink ? (
            <Button variant="outline" asChild onClick={() => logPreparation("whatsapp_direct")}>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                Ouvrir WhatsApp ({formatPhoneForDisplay(channel!.phone_number!)})
              </a>
            </Button>
          ) : null}

          {channel?.open_url ? (
            <Button variant="outline" asChild>
              <a
                href={channel.open_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                Ouvrir la destination
              </a>
            </Button>
          ) : null}

          {canShareFiles ? (
            <Button variant="outline" onClick={nativeShare} disabled={isPending}>
              <Share2 aria-hidden />
              Partager…
            </Button>
          ) : null}

          {!waLink && channel?.type !== "whatsapp_groupe" ? (
            <Button variant="outline" asChild>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                WhatsApp Web
              </a>
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        {deliveries.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Historique des partages</h3>
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {delivery.destination_label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deliveryMethodLabels[
                      delivery.method as keyof typeof deliveryMethodLabels
                    ] ?? delivery.method}{" "}
                    · préparé le {formatDateTime(delivery.created_at)}
                    {delivery.delivered_at
                      ? ` · confirmé le ${formatDateTime(delivery.delivered_at)}`
                      : ""}
                  </p>
                </div>
                {delivery.status === "confirme_envoye" ? (
                  <Badge className="bg-emerald-100 text-emerald-900">
                    Envoi confirmé
                  </Badge>
                ) : (
                  <>
                    <Badge variant="secondary">Préparé</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await confirmDeliverySent(delivery.id);
                          if (result.error) setError(result.error);
                        })
                      }
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Check aria-hidden />
                      )}
                      J&apos;ai envoyé
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
