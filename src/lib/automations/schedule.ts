import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, format, setDate } from "date-fns";

import { APP_TIMEZONE } from "@/lib/dates";

/**
 * Calcul des occurrences — 100 % pur et testable.
 *
 * Toutes les heures sont exprimées dans le fuseau de l'utilisateur
 * (Europe/Paris par défaut) puis converties en instant UTC pour le stockage.
 * C'est ce qui garantit que « vendredi à 15 h » reste 15 h même après un
 * changement d'heure.
 */

export type Frequency = "ponctuel" | "quotidien" | "hebdomadaire" | "mensuel";

export type ScheduleSpec = {
  frequency: Frequency;
  /** « HH:mm » ou « HH:mm:ss ». */
  timeOfDay: string;
  timezone?: string;
  /** 1 = lundi … 7 = dimanche. Requis pour « hebdomadaire ». */
  dayOfWeek?: number | null;
  /** 1–31. Requis pour « mensuel ». */
  dayOfMonth?: number | null;
};

function parseTimeOfDay(timeOfDay: string): { hours: number; minutes: number } {
  const [h, m] = timeOfDay.split(":");
  const hours = Number.parseInt(h ?? "0", 10);
  const minutes = Number.parseInt(m ?? "0", 10);
  return {
    hours: Number.isFinite(hours) ? Math.min(23, Math.max(0, hours)) : 0,
    minutes: Number.isFinite(minutes) ? Math.min(59, Math.max(0, minutes)) : 0,
  };
}

/** Applique une heure locale à une date, dans le fuseau donné. */
function atLocalTime(date: TZDate, timeOfDay: string): TZDate {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const result = new TZDate(date, date.timeZone ?? APP_TIMEZONE);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** 1 = lundi … 7 = dimanche (JavaScript renvoie 0 pour dimanche). */
export function isoDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Prochaine occurrence STRICTEMENT après `after`.
 * Retourne `null` pour un rappel ponctuel (il ne se rejoue pas).
 */
export function computeNextRun(
  spec: ScheduleSpec,
  after: Date = new Date()
): Date | null {
  const timezone = spec.timezone || APP_TIMEZONE;

  if (spec.frequency === "ponctuel") return null;

  const reference = new TZDate(after, timezone);

  if (spec.frequency === "quotidien") {
    let candidate = atLocalTime(reference, spec.timeOfDay);
    if (candidate.getTime() <= after.getTime()) {
      candidate = atLocalTime(
        new TZDate(addDays(candidate, 1), timezone),
        spec.timeOfDay
      );
    }
    return new Date(candidate.getTime());
  }

  if (spec.frequency === "hebdomadaire") {
    const target = spec.dayOfWeek ?? 1;
    let candidate = atLocalTime(reference, spec.timeOfDay);
    // Avance jusqu'au bon jour de semaine.
    let guard = 0;
    while (
      (isoDayOfWeek(candidate) !== target ||
        candidate.getTime() <= after.getTime()) &&
      guard < 15
    ) {
      candidate = atLocalTime(
        new TZDate(addDays(candidate, 1), timezone),
        spec.timeOfDay
      );
      guard++;
    }
    return new Date(candidate.getTime());
  }

  // Mensuel : on vise le jour demandé, en le ramenant au dernier jour du mois
  // si nécessaire (le 31 d'un mois de 30 jours devient le 30).
  const targetDay = spec.dayOfMonth ?? 1;
  let monthCursor = new TZDate(reference, timezone);
  for (let i = 0; i < 24; i++) {
    const daysInMonth = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      0
    ).getDate();
    const day = Math.min(targetDay, daysInMonth);
    const candidate = atLocalTime(
      new TZDate(setDate(monthCursor, day), timezone),
      spec.timeOfDay
    );
    if (candidate.getTime() > after.getTime()) {
      return new Date(candidate.getTime());
    }
    monthCursor = new TZDate(addMonths(monthCursor, 1), timezone);
  }
  return null;
}

/**
 * Clé d'occurrence : identifie de façon stable « cette exécution-là ».
 * C'est elle qui rend le planificateur idempotent — deux déclenchements de la
 * même occurrence produisent la même clé, et la contrainte d'unicité en base
 * empêche la seconde exécution.
 */
export function occurrenceKey(
  scheduledAt: Date,
  timezone: string = APP_TIMEZONE
): string {
  return format(new TZDate(scheduledAt, timezone), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Une règle récurrente est-elle due maintenant ?
 *
 * On considère due toute occurrence tombée dans la fenêtre écoulée depuis le
 * dernier passage du planificateur (tolérance par défaut : 10 minutes). Cela
 * évite de rater un déclenchement si le planificateur a pris du retard, sans
 * jamais rejouer une occurrence ancienne.
 */
export function isRuleDue(
  spec: ScheduleSpec,
  now: Date,
  toleranceMinutes = 10
): { due: boolean; scheduledAt: Date | null } {
  const windowStart = new Date(now.getTime() - toleranceMinutes * 60_000);

  // Occurrence attendue : la prochaine après le début de la fenêtre.
  const candidate = computeNextRun(spec, windowStart);
  if (!candidate) return { due: false, scheduledAt: null };

  const due = candidate.getTime() <= now.getTime();
  return { due, scheduledAt: due ? candidate : null };
}

/** Libellés français des fréquences, pour l'interface. */
export const frequencyLabels: Record<Frequency, string> = {
  ponctuel: "Une seule fois",
  quotidien: "Chaque jour",
  hebdomadaire: "Chaque semaine",
  mensuel: "Chaque mois",
};

export const dayOfWeekLabels: Record<number, string> = {
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
  7: "dimanche",
};
