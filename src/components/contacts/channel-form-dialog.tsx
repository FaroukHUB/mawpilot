"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { saveChannel } from "@/actions/contacts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANNEL_TYPES,
  channelTypeLabels,
  type ChannelType,
} from "@/lib/validations/contacts";

export type ChannelRow = {
  id: string;
  company_id: string;
  type: ChannelType;
  label: string;
  contact_id: string | null;
  phone_number: string | null;
  group_name: string | null;
  open_url: string | null;
  instructions: string | null;
  is_default: boolean;
  is_active: boolean;
};

type ChannelFormValues = {
  type: string;
  label: string;
  contact_id: string;
  phone_number: string;
  group_name: string;
  open_url: string;
  instructions: string;
  is_default: boolean;
};

export function ChannelFormDialog({
  companyId,
  contacts,
  channel,
  children,
}: {
  companyId: string;
  contacts: { id: string; name: string }[];
  channel?: ChannelRow;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<ChannelFormValues>({
    defaultValues: {
      type: channel?.type ?? "whatsapp_direct",
      label: channel?.label ?? "",
      contact_id: channel?.contact_id ?? "",
      phone_number: channel?.phone_number ?? "",
      group_name: channel?.group_name ?? "",
      open_url: channel?.open_url ?? "",
      instructions: channel?.instructions ?? "",
      is_default: channel?.is_default ?? false,
    },
  });

  const type = useWatch({ control, name: "type" });

  async function onSubmit(values: ChannelFormValues) {
    setServerError(null);
    const result = await saveChannel(
      { ...values, company_id: companyId },
      channel?.id
    );
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {channel ? "Modifier la destination" : "Nouvelle destination"}
          </DialogTitle>
          <DialogDescription>
            Où envoyer les rapports de cette entreprise.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-type">Type *</Label>
              <Select id="channel-type" {...register("type")}>
                {CHANNEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {channelTypeLabels[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-label">Libellé *</Label>
              <Input
                id="channel-label"
                required
                placeholder="Groupe direction, WhatsApp de Karim…"
                {...register("label", { required: true })}
              />
            </div>
          </div>

          {type === "whatsapp_direct" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-phone">Numéro international *</Label>
              <Input
                id="channel-phone"
                placeholder="+33612345678"
                {...register("phone_number")}
              />
              <p className="text-xs text-muted-foreground">
                Un lien WhatsApp direct sera généré avec le message prérempli.
              </p>
            </div>
          ) : null}

          {type === "whatsapp_groupe" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-group">Nom du groupe *</Label>
              <Input
                id="channel-group"
                placeholder="Suivi SEO — Trust Industrie"
                {...register("group_name")}
              />
              <p className="rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
                WhatsApp ne permet pas d&apos;ouvrir un groupe à partir de son
                nom. L&apos;application préparera le message et ouvrira
                WhatsApp : vous sélectionnerez le groupe vous-même.
              </p>
            </div>
          ) : null}

          {contacts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="channel-contact">Contact associé</Label>
              <Select id="channel-contact" {...register("contact_id")}>
                <option value="">— Aucun —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-url">URL d&apos;ouverture</Label>
            <Input
              id="channel-url"
              placeholder="https://… (uniquement si vous en avez une valide)"
              {...register("open_url")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-instructions">Instructions</Label>
            <Textarea
              id="channel-instructions"
              rows={2}
              placeholder="Envoyer dans le groupe Suivi SEO le vendredi…"
              {...register("instructions")}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand-orange)]"
              {...register("is_default")}
            />
            Destination par défaut pour les rapports
          </label>

          {serverError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
