"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2, Plus, X } from "lucide-react";

import { cancelReminder, createReminder } from "@/actions/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  dayOfWeekLabels,
  frequencyLabels,
  type Frequency,
} from "@/lib/automations/schedule";
import { formatDateTime } from "@/lib/dates";

export type ReminderRow = {
  id: string;
  title: string;
  body: string | null;
  frequency: Frequency;
  next_run_at: string;
  time_of_day: string;
  day_of_week: number | null;
  day_of_month: number | null;
  company_id: string | null;
  companies: { name: string } | null;
};

type FormValues = {
  title: string;
  company_id: string;
  frequency: string;
  run_at: string;
  time_of_day: string;
  day_of_week: string;
  day_of_month: string;
};

function describeRecurrence(reminder: ReminderRow): string {
  switch (reminder.frequency) {
    case "quotidien":
      return `chaque jour à ${reminder.time_of_day.slice(0, 5)}`;
    case "hebdomadaire":
      return `chaque ${dayOfWeekLabels[reminder.day_of_week ?? 1]} à ${reminder.time_of_day.slice(0, 5)}`;
    case "mensuel":
      return `le ${reminder.day_of_month} de chaque mois à ${reminder.time_of_day.slice(0, 5)}`;
    default:
      return "une seule fois";
  }
}

export function ReminderList({
  reminders,
  companies,
}: {
  reminders: ReminderRow[];
  companies: { id: string; name: string }[];
}) {
  const [showForm, setShowForm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const list = Array.isArray(reminders) ? reminders : [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      company_id: "",
      frequency: "ponctuel",
      run_at: "",
      time_of_day: "09:00",
      day_of_week: "5",
      day_of_month: "1",
    },
  });

  const frequency = useWatch({ control, name: "frequency" });

  async function onSubmit(values: FormValues) {
    setError(null);
    const result = await createReminder(values);
    if (result.error) {
      setError(result.error);
      return;
    }
    reset();
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun rappel programmé.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((reminder) => (
            <div
              key={reminder.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">
                  Prochain : {formatDateTime(reminder.next_run_at)} ·{" "}
                  {describeRecurrence(reminder)}
                  {reminder.companies ? ` · ${reminder.companies.name}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Annuler le rappel ${reminder.title}`}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await cancelReminder(reminder.id);
                    if (result.error) setError(result.error);
                  })
                }
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 rounded-lg border p-3"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="reminder-title">Intitulé *</Label>
            <Input
              id="reminder-title"
              required
              placeholder="Relancer Djamel"
              {...register("title", { required: true })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder-frequency">Fréquence</Label>
              <Select id="reminder-frequency" {...register("frequency")}>
                {(
                  Object.keys(frequencyLabels) as (keyof typeof frequencyLabels)[]
                ).map((key) => (
                  <option key={key} value={key}>
                    {frequencyLabels[key]}
                  </option>
                ))}
              </Select>
            </div>

            {frequency === "ponctuel" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-run-at">Date et heure *</Label>
                <Input
                  id="reminder-run-at"
                  type="datetime-local"
                  {...register("run_at")}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-time">Heure</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  {...register("time_of_day")}
                />
              </div>
            )}

            {frequency === "hebdomadaire" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-day">Jour</Label>
                <Select id="reminder-day" {...register("day_of_week")}>
                  {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {frequency === "mensuel" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-day-month">Jour du mois</Label>
                <Input
                  id="reminder-day-month"
                  type="number"
                  min="1"
                  max="31"
                  {...register("day_of_month")}
                />
              </div>
            ) : null}

            {companies.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="reminder-company">Entreprise</Label>
                <Select id="reminder-company" {...register("company_id")}>
                  <option value="">— Aucune —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Programmer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setShowForm(true)}
          >
            <Plus aria-hidden />
            Ajouter un rappel
          </Button>
        </div>
      )}
    </div>
  );
}
