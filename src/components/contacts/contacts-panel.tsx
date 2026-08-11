"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Star,
  Users,
} from "lucide-react";

import { setChannelActive, setContactActive } from "@/actions/contacts";
import {
  ChannelFormDialog,
  type ChannelRow,
} from "@/components/contacts/channel-form-dialog";
import {
  ContactFormDialog,
  type ContactRow,
} from "@/components/contacts/contact-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildWhatsAppLink, formatPhoneForDisplay } from "@/lib/whatsapp";
import { channelTypeLabels } from "@/lib/validations/contacts";

export function ContactsPanel({
  companyId,
  contacts,
  channels,
}: {
  companyId: string;
  contacts: ContactRow[];
  channels: ChannelRow[];
}) {
  const [isPending, startTransition] = React.useTransition();
  const activeContacts = contacts.filter((c) => c.is_active);
  const archivedContacts = contacts.filter((c) => !c.is_active);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden />
            Contacts ({activeContacts.length})
          </CardTitle>
          <ContactFormDialog companyId={companyId}>
            <Button size="sm" variant="outline">
              <Plus aria-hidden />
              Contact
            </Button>
          </ContactFormDialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun contact enregistré pour cette entreprise.
            </p>
          ) : (
            [...activeContacts, ...archivedContacts].map((contact) => {
              const waLink = contact.whatsapp_number
                ? buildWhatsAppLink(contact.whatsapp_number)
                : null;
              return (
                <div
                  key={contact.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    contact.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {contact.name}
                      {contact.role ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          — {contact.role}
                        </span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Mail className="size-3" aria-hidden />
                          {contact.email}
                        </a>
                      ) : null}
                      {contact.phone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" aria-hidden />
                          {contact.phone}
                        </span>
                      ) : null}
                      {contact.whatsapp_number ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="size-3" aria-hidden />
                          {formatPhoneForDisplay(contact.whatsapp_number)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!contact.is_active ? (
                    <Badge variant="secondary">Archivé</Badge>
                  ) : null}
                  {waLink ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle aria-hidden />
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  <ContactFormDialog companyId={companyId} contact={contact}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${contact.name}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </ContactFormDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    aria-label={
                      contact.is_active
                        ? `Archiver ${contact.name}`
                        : `Réactiver ${contact.name}`
                    }
                    onClick={() =>
                      startTransition(async () => {
                        await setContactActive(contact.id, !contact.is_active);
                      })
                    }
                  >
                    {contact.is_active ? (
                      <Archive aria-hidden />
                    ) : (
                      <ArchiveRestore aria-hidden />
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden />
            Destinations des rapports ({channels.filter((c) => c.is_active).length})
          </CardTitle>
          <ChannelFormDialog
            companyId={companyId}
            contacts={activeContacts.map((c) => ({ id: c.id, name: c.name }))}
          >
            <Button size="sm" variant="outline">
              <Plus aria-hidden />
              Destination
            </Button>
          </ChannelFormDialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune destination. Ajoutez le WhatsApp ou le groupe où vous
              envoyez habituellement les rapports.
            </p>
          ) : (
            channels.map((channel) => {
              const waLink =
                channel.type === "whatsapp_direct" && channel.phone_number
                  ? buildWhatsAppLink(channel.phone_number)
                  : null;
              return (
                <div
                  key={channel.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    channel.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {channel.label}
                      {channel.is_default ? (
                        <Star
                          className="size-3.5 fill-brand-yellow text-brand-yellow"
                          aria-label="Destination par défaut"
                        />
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {channelTypeLabels[channel.type]}
                      {channel.phone_number
                        ? ` · ${formatPhoneForDisplay(channel.phone_number)}`
                        : ""}
                      {channel.group_name ? ` · « ${channel.group_name} »` : ""}
                    </p>
                    {channel.instructions ? (
                      <p className="text-xs text-muted-foreground">
                        {channel.instructions}
                      </p>
                    ) : null}
                  </div>
                  {!channel.is_active ? (
                    <Badge variant="secondary">Archivée</Badge>
                  ) : null}
                  {waLink ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={waLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle aria-hidden />
                        Ouvrir
                      </a>
                    </Button>
                  ) : null}
                  {channel.open_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={channel.open_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink aria-hidden />
                        Ouvrir
                      </a>
                    </Button>
                  ) : null}
                  <ChannelFormDialog
                    companyId={companyId}
                    contacts={activeContacts.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                    channel={channel}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${channel.label}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </ChannelFormDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    aria-label={
                      channel.is_active
                        ? `Archiver ${channel.label}`
                        : `Réactiver ${channel.label}`
                    }
                    onClick={() =>
                      startTransition(async () => {
                        await setChannelActive(channel.id, !channel.is_active);
                      })
                    }
                  >
                    {channel.is_active ? (
                      <Archive aria-hidden />
                    ) : (
                      <ArchiveRestore aria-hidden />
                    )}
                  </Button>
                </div>
              );
            })
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Rappel : l&apos;application prépare le message, vous restez seul à
            l&apos;envoyer. Un groupe WhatsApp ne peut pas être sélectionné
            automatiquement à partir de son nom.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
