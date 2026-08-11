"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Check, Loader2 } from "lucide-react";

import { updateBudget } from "@/actions/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/ai/pricing";

type BudgetFormValues = {
  credit_usd: string;
  alert_threshold_usd: string;
  price_input_per_million: string;
  price_cached_input_per_million: string;
  price_output_per_million: string;
  price_transcription_per_minute: string;
  reset_counter: boolean;
};

export function BudgetForm({
  defaultValues,
  spentSinceCreditUsd,
}: {
  defaultValues: BudgetFormValues;
  spentSinceCreditUsd: number;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BudgetFormValues>({ defaultValues });

  async function onSubmit(values: BudgetFormValues) {
    setServerError(null);
    setSaved(false);
    const result = await updateBudget(values);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-credit">Crédit acheté ($)</Label>
          <Input
            id="budget-credit"
            type="number"
            min="0"
            step="0.01"
            {...register("credit_usd")}
          />
          <p className="text-xs text-muted-foreground">
            Montant rechargé sur platform.openai.com. Consommé depuis :{" "}
            {formatUsd(spentSinceCreditUsd)}.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-alert">Alerte quand il reste ($)</Label>
          <Input
            id="budget-alert"
            type="number"
            min="0"
            step="0.5"
            {...register("alert_threshold_usd")}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--brand-orange)]"
          {...register("reset_counter")}
        />
        <span>
          Je viens de recharger mon compte : repartir de zéro.
          <span className="block text-xs text-muted-foreground">
            Le compteur « consommé » redémarre maintenant. L&apos;historique
            des demandes reste intact.
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          Tarifs du modèle ($ par million de jetons)
        </legend>
        <p className="text-xs text-muted-foreground">
          À recopier depuis la page Tarifs d&apos;OpenAI pour le modèle que vous
          utilisez. Ces valeurs servent uniquement au calcul affiché ici.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="price-input">Entrée</Label>
            <Input
              id="price-input"
              type="number"
              min="0"
              step="0.01"
              {...register("price_input_per_million")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price-cached">Entrée en cache</Label>
            <Input
              id="price-cached"
              type="number"
              min="0"
              step="0.001"
              {...register("price_cached_input_per_million")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="price-output">Sortie</Label>
            <Input
              id="price-output"
              type="number"
              min="0"
              step="0.01"
              {...register("price_output_per_million")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price-transcription">
            Transcription ($ par minute d&apos;audio)
          </Label>
          <Input
            id="price-transcription"
            type="number"
            min="0"
            step="0.001"
            className="sm:max-w-48"
            {...register("price_transcription_per_minute")}
          />
        </div>
      </fieldset>

      {serverError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Enregistrer
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" aria-hidden />
            Enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}
