import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { fr } from "date-fns/locale";

import { now, toAppZone } from "@/lib/dates";
import type { ReportPeriod } from "@/lib/reports/types";

/** Semaine écoulée (lundi → dimanche), fuseau Europe/Paris. */
export function lastWeekPeriod(reference: Date = now()): ReportPeriod {
  const ref = subWeeks(reference, 1);
  return {
    start: format(startOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

/** Semaine en cours (lundi → dimanche). */
export function currentWeekPeriod(reference: Date = now()): ReportPeriod {
  return {
    start: format(startOfWeek(reference, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(reference, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

/** Mois écoulé. */
export function lastMonthPeriod(reference: Date = now()): ReportPeriod {
  const ref = subMonths(reference, 1);
  return {
    start: format(startOfMonth(ref), "yyyy-MM-dd"),
    end: format(endOfMonth(ref), "yyyy-MM-dd"),
  };
}

/** Mois en cours. */
export function currentMonthPeriod(reference: Date = now()): ReportPeriod {
  return {
    start: format(startOfMonth(reference), "yyyy-MM-dd"),
    end: format(endOfMonth(reference), "yyyy-MM-dd"),
  };
}

/** « du 4 au 10 août 2026 » ou « août 2026 » pour un mois complet. */
export function formatPeriodLabel(period: ReportPeriod): string {
  const start = toAppZone(period.start);
  const end = toAppZone(period.end);

  const isFullMonth =
    format(startOfMonth(start), "yyyy-MM-dd") === period.start &&
    format(endOfMonth(start), "yyyy-MM-dd") === period.end;

  if (isFullMonth) {
    return format(start, "LLLL yyyy", { locale: fr });
  }

  const sameMonth = format(start, "yyyy-MM") === format(end, "yyyy-MM");
  if (sameMonth) {
    return `du ${format(start, "d", { locale: fr })} au ${format(end, "d MMMM yyyy", { locale: fr })}`;
  }
  return `du ${format(start, "d MMMM", { locale: fr })} au ${format(end, "d MMMM yyyy", { locale: fr })}`;
}

/** Titre par défaut : « Rapport hebdomadaire — Trust Industrie (du 4 au 10 août 2026) ». */
export function buildReportTitle(
  type: "hebdomadaire" | "mensuel" | "personnalise",
  companyName: string,
  period: ReportPeriod
): string {
  const typeLabel =
    type === "hebdomadaire"
      ? "Rapport hebdomadaire"
      : type === "mensuel"
        ? "Rapport mensuel"
        : "Rapport";
  return `${typeLabel} — ${companyName} (${formatPeriodLabel(period)})`;
}
