"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2, ShieldAlert } from "lucide-react";

import { saveResource } from "@/actions/resources";
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
  resourceCategoryLabels,
  resourceGroups,
  type ResourceCategory,
} from "@/lib/validations/resources";

export type ResourceRow = {
  id: string;
  company_id: string;
  category: ResourceCategory;
  label: string;
  url: string;
  description: string | null;
  access_notes: string | null;
  login_hint: string | null;
  password_manager_ref: string | null;
  is_favorite: boolean;
  sort_order: number;
  last_checked_at: string | null;
  is_active: boolean;
};

type ResourceFormValues = {
  category: string;
  label: string;
  url: string;
  description: string;
  access_notes: string;
  login_hint: string;
  password_manager_ref: string;
  is_favorite: boolean;
};

export function ResourceFormDialog({
  companyId,
  resource,
  children,
}: {
  companyId: string;
  resource?: ResourceRow;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResourceFormValues>({
    defaultValues: {
      category: resource?.category ?? "site_public",
      label: resource?.label ?? "",
      url: resource?.url ?? "",
      description: resource?.description ?? "",
      access_notes: resource?.access_notes ?? "",
      login_hint: resource?.login_hint ?? "",
      password_manager_ref: resource?.password_manager_ref ?? "",
      is_favorite: resource?.is_favorite ?? false,
    },
  });

  async function onSubmit(values: ResourceFormValues) {
    setServerError(null);
    const result = await saveResource(
      { ...values, company_id: companyId, sort_order: resource?.sort_order ?? 0 },
      resource?.id
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
            {resource ? "Modifier l'accès rapide" : "Nouvel accès rapide"}
          </DialogTitle>
          <DialogDescription>
            Un raccourci vers un site ou un outil de cette entreprise.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="resource-category">Catégorie</Label>
              <Select id="resource-category" {...register("category")}>
                {resourceGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.categories.map((c) => (
                      <option key={c} value={c}>
                        {resourceCategoryLabels[c]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="resource-label">Libellé *</Label>
              <Input
                id="resource-label"
                required
                placeholder="Search Console — trust-industrie.fr"
                {...register("label", { required: true })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-url">URL *</Label>
            <Input
              id="resource-url"
              required
              placeholder="https://…"
              {...register("url", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-description">Description</Label>
            <Input id="resource-description" {...register("description")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="resource-login">Identifiant de connexion</Label>
              <Input
                id="resource-login"
                placeholder="contact@entreprise.fr"
                {...register("login_hint")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="resource-pm">Entrée gestionnaire de mots de passe</Label>
              <Input
                id="resource-pm"
                placeholder="Nom de l'entrée dans votre coffre"
                {...register("password_manager_ref")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-notes">Notes d&apos;accès</Label>
            <Textarea
              id="resource-notes"
              rows={2}
              placeholder="Passer par le menu Réglages puis Domaines…"
              {...register("access_notes")}
            />
          </div>
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            N&apos;enregistrez jamais ici de mot de passe, clé API, code de
            récupération ou secret. Utilisez un gestionnaire de mots de passe et
            indiquez seulement le nom de l&apos;entrée.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand-orange)]"
              {...register("is_favorite")}
            />
            Favori (affiché en premier)
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
