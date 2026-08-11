import {
  endOfWeek,
  format,
  formatDistanceToNow,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

/**
 * Toutes les dates de l'application sont affichées et interprétées
 * dans le fuseau Europe/Paris, en français.
 * Les dates sont stockées en UTC dans PostgreSQL (timestamptz).
 */
export const APP_TIMEZONE = "Europe/Paris";
export const APP_LOCALE = fr;

/** Date/heure courante dans le fuseau de l'application. */
export function now(): TZDate {
  return TZDate.tz(APP_TIMEZONE);
}

/** Convertit une date (UTC ou locale) vers le fuseau de l'application. */
export function toAppZone(date: Date | string | number): TZDate {
  return new TZDate(new Date(date), APP_TIMEZONE);
}

/** Format long : « lundi 11 août 2026 ». */
export function formatDateLong(date: Date | string | number): string {
  return format(toAppZone(date), "EEEE d MMMM yyyy", { locale: fr });
}

/** Format court : « 11/08/2026 ». */
export function formatDateShort(date: Date | string | number): string {
  return format(toAppZone(date), "dd/MM/yyyy", { locale: fr });
}

/** Format avec heure : « 11/08/2026 à 14:30 ». */
export function formatDateTime(date: Date | string | number): string {
  return format(toAppZone(date), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
}

/** Distance relative : « il y a 2 heures ». */
export function formatRelative(date: Date | string | number): string {
  return formatDistanceToNow(new Date(date), { locale: fr, addSuffix: true });
}

/** Date du jour au format ISO (yyyy-MM-dd), fuseau de l'application. */
export function todayISODate(): string {
  return format(now(), "yyyy-MM-dd");
}

/** Premier jour du mois courant au format ISO. */
export function monthStartISODate(): string {
  return format(startOfMonth(now()), "yyyy-MM-dd");
}

/** Dernier jour de la semaine courante (dimanche) au format ISO. */
export function weekEndISODate(): string {
  return format(endOfWeek(now(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Durée en minutes → « 2 h 30 » ou « 45 min ». */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
