"use client";

import * as React from "react";
import { Loader2, Plus, Power, PowerOff } from "lucide-react";

import { saveAutomationRule, setRuleActive } from "@/actions/reminders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { dayOfWeekLabels, type Frequency } from "@/lib/automations/schedule";

export type RuleRow = {
  id: string;
  kind: string;
  company_id: string | null;
  frequency: Frequency;
  time_of_day: string;
  day_of_week: number | null;
  day_of_month: number | null;
  params: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  companies: { name: string } | null;
};

const KIND_LABELS: Record<string, { title: string; description: string }> = {
  briefing_matin: {
    title: "Briefing du matin",
    description: "Urgences, retards et priorités du jour",
  },
  compte_rendu_soir: {
    title: "Compte rendu du soir",
    description: "Invitation à dicter votre journée",
  },
  rapport_hebdo: {
    title: "Rapport hebdomadaire",
    description: "Brouillon préparé automatiquement, jamais envoyé",
  },
  relance_sans_reponse: {
    title: "Relance sans réponse",
    description: "Alerte si un client ne répond pas",
  },
  saisie_temps_manquante: {
    title: "Temps non saisi",
    description: "Alerte si aucun temps n'est enregistré",
  },
};

export function AutomationRules({
  rules,
  companies,
}: {
  rules: RuleRow[];
  companies: { id: string; name: string }[];
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [kind, setKind] = React.useState("briefing_matin");
  const [companyId, setCompanyId] = React.useState("");
  const [frequency, setFrequency] = React.useState<string>("quotidien");
  const [timeOfDay, setTimeOfDay] = React.useState("08:00");
  const [dayOfWeek, setDayOfWeek] = React.useState("5");
  const [days, setDays] = React.useState("3");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const list = Array.isArray(rules) ? rules : [];
  const needsCompany = kind === "rapport_hebdo";
  const needsDays =
    kind === "relance_sans_reponse" || kind === "saisie_temps_manquante";

  function add() {
    setError(null);
    if (needsCompany && !companyId) {
      setError("Choisissez l'entreprise concernée par le rapport.");
      return;
    }
    startTransition(async () => {
      const result = await saveAutomationRule({
        kind,
        company_id: companyId,
        frequency: kind === "rapport_hebdo" ? "hebdomadaire" : frequency,
        time_of_day: timeOfDay,
        day_of_week:
          (kind === "rapport_hebdo" ? true : frequency === "hebdomadaire")
            ? Number(dayOfWeek)
            : null,
        params: needsDays ? { jours: Number(days) } : {},
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowForm(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune automatisation. Ajoutez-en une, ou dites « chaque vendredi
          prépare le rapport de Trust Industrie » à MAW.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((rule) => {
            const meta = KIND_LABELS[rule.kind] ?? {
              title: rule.kind,
              description: "",
            };
            return (
              <div
                key={rule.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  rule.is_active ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {meta.title}
                    {rule.companies ? ` — ${rule.companies.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meta.description} ·{" "}
                    {rule.frequency === "hebdomadaire"
                      ? `chaque ${dayOfWeekLabels[rule.day_of_week ?? 1]}`
                      : "chaque jour"}{" "}
                    à {rule.time_of_day.slice(0, 5)}
                  </p>
                </div>
                {!rule.is_active ? (
                  <Badge variant="secondary">Désactivée</Badge>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={
                    rule.is_active
                      ? `Désactiver ${meta.title}`
                      : `Activer ${meta.title}`
                  }
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await setRuleActive(rule.id, !rule.is_active);
                    })
                  }
                >
                  {rule.is_active ? (
                    <Power aria-hidden />
                  ) : (
                    <PowerOff aria-hidden />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-kind">Type</Label>
            <Select
              id="rule-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {Object.entries(KIND_LABELS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {needsCompany || companies.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-company">
                  Entreprise {needsCompany ? "*" : ""}
                </Label>
                <Select
                  id="rule-company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">
                    {needsCompany ? "— Choisir —" : "— Toutes —"}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-time">Heure</Label>
              <Input
                id="rule-time"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>

            {kind === "rapport_hebdo" || frequency === "hebdomadaire" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-day">Jour</Label>
                <Select
                  id="rule-day"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {kind !== "rapport_hebdo" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-frequency">Fréquence</Label>
                <Select
                  id="rule-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="quotidien">Chaque jour</option>
                  <option value="hebdomadaire">Chaque semaine</option>
                </Select>
              </div>
            ) : null}

            {needsDays ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="rule-days">Après combien de jours</Label>
                <Input
                  id="rule-days"
                  type="number"
                  min="1"
                  max="60"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={add} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Activer
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowForm(true)}
        >
          <Plus aria-hidden />
          Ajouter une automatisation
        </Button>
      )}
    </div>
  );
}
