"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { createCompany, updateCompany } from "@/actions/companies";
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
import type { Company } from "@/types/database";

type CompanyFormValues = {
  name: string;
  color: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  monthly_amount: string;
  included_services: string;
  notes: string;
};

function toFormValues(company?: Company): CompanyFormValues {
  return {
    name: company?.name ?? "",
    color: company?.color ?? "#FFA000",
    contact_name: company?.contact_name ?? "",
    contact_email: company?.contact_email ?? "",
    contact_phone: company?.contact_phone ?? "",
    website: company?.website ?? "",
    monthly_amount: company?.monthly_amount?.toString() ?? "",
    included_services: company?.included_services ?? "",
    notes: company?.notes ?? "",
  };
}

export function CompanyFormDialog({
  company,
  children,
}: {
  company?: Company;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CompanyFormValues>({ defaultValues: toFormValues(company) });

  async function onSubmit(values: CompanyFormValues) {
    setServerError(null);
    const result = company
      ? await updateCompany(company.id, values)
      : await createCompany(values);

    if (result.error) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
    reset(company ? values : toFormValues());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(toFormValues(company));
          setServerError(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {company ? "Modifier l'entreprise" : "Nouvelle entreprise"}
          </DialogTitle>
          <DialogDescription>
            {company
              ? "Les modifications sont journalisées dans l'historique."
              : "Seul le nom est obligatoire, le reste peut être complété plus tard."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-name">Nom *</Label>
              <Input
                id="company-name"
                required
                {...register("name", { required: true })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-color">Couleur</Label>
              <input
                id="company-color"
                type="color"
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
                {...register("color")}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-contact">Contact principal</Label>
              <Input id="company-contact" {...register("contact_name")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-email">Email</Label>
              <Input
                id="company-email"
                type="email"
                {...register("contact_email")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-phone">Téléphone</Label>
              <Input id="company-phone" {...register("contact_phone")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-website">Site web</Label>
              <Input
                id="company-website"
                placeholder="https://…"
                {...register("website")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="company-amount">Montant mensuel (€)</Label>
            <Input
              id="company-amount"
              type="number"
              min="0"
              step="0.01"
              {...register("monthly_amount")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="company-services">Prestations incluses</Label>
            <Textarea
              id="company-services"
              rows={3}
              placeholder="Ce que couvre le forfait mensuel…"
              {...register("included_services")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="company-notes">Notes</Label>
            <Textarea id="company-notes" rows={3} {...register("notes")} />
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
              {company ? "Enregistrer" : "Créer l'entreprise"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
