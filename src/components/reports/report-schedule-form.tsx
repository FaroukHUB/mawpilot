"use client";

import * as React from "react";
import { CalendarClock, Check, Loader2, Power } from "lucide-react";

import {
  disableReportSchedule,
  saveReportSchedule,
} from "@/actions/report-schedules";
import { REPORT_FORMATS, reportFormatLabels } from "@/lib/reports/formats";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { dayOfWeekLabels } from "@/lib/automations/schedule";
import {
  REPORT_SECTION_KEYS,
  reportSectionLabels,
  type ReportSectionKey,
} from "@/lib/reports/types";

export type ReportScheduleRow = {
  company_id: string;
  frequency: "hebdomadaire" | "mensuel";
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  default_channel_id: string | null;
  default_format: string;
  sections: string[] | null;
  is_active: boolean;
};

/** Sections retenues par défaut : tout sauf « Résultats » (à saisir soi-même). */
const DEFAULT_SECTIONS: ReportSectionKey[] = REPORT_SECTION_KEYS.filter(
  (key) => key !== "resultats"
);

export function ReportScheduleForm({
  companyId,
  schedule,
  channels,
}: {
  companyId: string;
  schedule: ReportScheduleRow | null;
  channels: { id: string; label: string }[];
}) {
  const [frequency, setFrequency] = React.useState(
    schedule?.frequency ?? "hebdomadaire"
  );
  const [dayOfWeek, setDayOfWeek] = React.useState(
    String(schedule?.day_of_week ?? 5)
  );
  const [dayOfMonth, setDayOfMonth] = React.useState(
    String(schedule?.day_of_month ?? 1)
  );
  const [timeOfDay, setTimeOfDay] = React.useState(
    (schedule?.time_of_day ?? "18:00").slice(0, 5)
  );
  const [channelId, setChannelId] = React.useState(
    schedule?.default_channel_id ?? ""
  );
  const [format, setFormat] = React.useState(
    schedule?.default_format ?? "whatsapp"
  );
  const [sections, setSections] = React.useState<string[]>(
    schedule?.sections && schedule.sections.length > 0
      ? schedule.sections
      : DEFAULT_SECTIONS
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const isActive = schedule?.is_active ?? false;

  function toggleSection(key: string) {
    setSaved(false);
    setSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveReportSchedule({
        company_id: companyId,
        frequency,
        day_of_week: frequency === "hebdomadaire" ? Number(dayOfWeek) : null,
        day_of_month: frequency === "mensuel" ? Number(dayOfMonth) : null,
        time_of_day: timeOfDay,
        default_channel_id: channelId,
        default_format: format,
        sections,
        is_active: true,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden />
          Préparation automatique
        </CardTitle>
        <CardDescription>
          Le brouillon est préparé à partir des <strong>données
          enregistrées</strong> uniquement, et vous êtes notifié quand il est
          prêt. Rien n&apos;est jamais envoyé au client sans vous.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-frequency">Fréquence</Label>
            <Select
              id="schedule-frequency"
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value as "hebdomadaire" | "mensuel");
                setSaved(false);
              }}
            >
              <option value="hebdomadaire">Chaque semaine</option>
              <option value="mensuel">Chaque mois</option>
            </Select>
          </div>

          {frequency === "hebdomadaire" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-day">Jour</Label>
              <Select
                id="schedule-day"
                value={dayOfWeek}
                onChange={(e) => {
                  setDayOfWeek(e.target.value);
                  setSaved(false);
                }}
              >
                {Object.entries(dayOfWeekLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-day-month">Jour du mois</Label>
              <Input
                id="schedule-day-month"
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => {
                  setDayOfMonth(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-time">Heure</Label>
            <Input
              id="schedule-time"
              type="time"
              value={timeOfDay}
              onChange={(e) => {
                setTimeOfDay(e.target.value);
                setSaved(false);
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-channel">Destination habituelle</Label>
            <Select
              id="schedule-channel"
              value={channelId}
              onChange={(e) => {
                setChannelId(e.target.value);
                setSaved(false);
              }}
            >
              <option value="">— À choisir au moment du partage —</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-format">Format préféré</Label>
            <Select
              id="schedule-format"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setSaved(false);
              }}
            >
              {REPORT_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {reportFormatLabels[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">
            Sections incluses ({sections.length})
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {REPORT_SECTION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand-orange)]"
                  checked={sections.includes(key)}
                  onChange={() => toggleSection(key)}
                />
                {reportSectionLabels[key]}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            {isActive ? "Enregistrer" : "Activer la préparation automatique"}
          </Button>

          {isActive ? (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await disableReportSchedule(companyId);
                  setSaved(false);
                })
              }
            >
              <Power aria-hidden />
              Désactiver
            </Button>
          ) : null}

          {saved ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="size-4" aria-hidden />
              Enregistré
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
