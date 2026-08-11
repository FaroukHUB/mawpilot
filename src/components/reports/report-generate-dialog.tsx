"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { Loader2, Sparkles } from "lucide-react";

import { generateReport } from "@/actions/reports";
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

type GenerateFormValues = {
  company_id: string;
  type: string;
  preset: string;
  period_start: string;
  period_end: string;
};

export function ReportGenerateDialog({
  companies,
  presets,
  defaultCompanyId,
  children,
}: {
  companies: { id: string; name: string }[];
  presets: {
    lastWeek: { start: string; end: string };
    currentWeek: { start: string; end: string };
    lastMonth: { start: string; end: string };
    currentMonth: { start: string; end: string };
  };
  defaultCompanyId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm<GenerateFormValues>({
    defaultValues: {
      company_id: defaultCompanyId ?? companies[0]?.id ?? "",
      type: "hebdomadaire",
      preset: "lastWeek",
      period_start: presets.lastWeek.start,
      period_end: presets.lastWeek.end,
    },
  });

  const preset = useWatch({ control, name: "preset" });

  React.useEffect(() => {
    if (preset === "personnalise") return;
    const chosen = presets[preset as keyof typeof presets];
    if (!chosen) return;
    setValue("period_start", chosen.start);
    setValue("period_end", chosen.end);
    setValue(
      "type",
      preset === "lastMonth" || preset === "currentMonth"
        ? "mensuel"
        : "hebdomadaire"
    );
  }, [preset, presets, setValue]);

  async function onSubmit(values: GenerateFormValues) {
    setServerError(null);
    const result = await generateReport({
      company_id: values.company_id,
      type: values.type,
      period_start: values.period_start,
      period_end: values.period_end,
    });
    if (result.error || !result.data) {
      setServerError(result.error ?? "Génération impossible.");
      return;
    }
    setOpen(false);
    router.push(`/rapports/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer un rapport</DialogTitle>
          <DialogDescription>
            Le rapport rassemble uniquement les données enregistrées sur la
            période : tâches terminées, temps, livrables, blocages et
            prestations.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-company">Entreprise *</Label>
            <Select id="report-company" required {...register("company_id")}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-preset">Période</Label>
            <Select id="report-preset" {...register("preset")}>
              <option value="lastWeek">Semaine dernière</option>
              <option value="currentWeek">Semaine en cours</option>
              <option value="lastMonth">Mois dernier</option>
              <option value="currentMonth">Mois en cours</option>
              <option value="personnalise">Période personnalisée</option>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-start">Du</Label>
              <Input
                id="report-start"
                type="date"
                required
                {...register("period_start")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-end">Au</Label>
              <Input
                id="report-end"
                type="date"
                required
                {...register("period_end")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-type">Type</Label>
            <Select id="report-type" {...register("type")}>
              <option value="hebdomadaire">Hebdomadaire</option>
              <option value="mensuel">Mensuel</option>
              <option value="personnalise">Personnalisé</option>
            </Select>
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
              ) : (
                <Sparkles aria-hidden />
              )}
              Générer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
