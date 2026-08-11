"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { saveContact } from "@/actions/contacts";
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
import { Textarea } from "@/components/ui/textarea";

export type ContactRow = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  preferred_channel: string | null;
  notes: string | null;
  is_active: boolean;
};

type ContactFormValues = {
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  preferred_channel: string;
  notes: string;
};

export function ContactFormDialog({
  companyId,
  contact,
  children,
}: {
  companyId: string;
  contact?: ContactRow;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ContactFormValues>({
    defaultValues: {
      name: contact?.name ?? "",
      role: contact?.role ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      whatsapp_number: contact?.whatsapp_number ?? "",
      preferred_channel: contact?.preferred_channel ?? "",
      notes: contact?.notes ?? "",
    },
  });

  async function onSubmit(values: ContactFormValues) {
    setServerError(null);
    const result = await saveContact(
      { ...values, company_id: companyId },
      contact?.id
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
            {contact ? "Modifier le contact" : "Nouveau contact"}
          </DialogTitle>
          <DialogDescription>
            Le numéro WhatsApp doit être au format international pour permettre
            un lien direct.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-name">Nom *</Label>
              <Input
                id="contact-name"
                required
                {...register("name", { required: true })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-role">Rôle / fonction</Label>
              <Input
                id="contact-role"
                placeholder="Directeur, responsable marketing…"
                {...register("role")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" {...register("email")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-phone">Téléphone</Label>
              <Input id="contact-phone" {...register("phone")} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-whatsapp">Numéro WhatsApp</Label>
            <Input
              id="contact-whatsapp"
              placeholder="+33612345678"
              {...register("whatsapp_number")}
            />
            <p className="text-xs text-muted-foreground">
              Format international avec l&apos;indicatif pays, sans espaces ni
              zéro initial.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-channel">Canal préféré</Label>
            <Input
              id="contact-channel"
              placeholder="WhatsApp, email, téléphone…"
              {...register("preferred_channel")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea id="contact-notes" rows={2} {...register("notes")} />
          </div>
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
