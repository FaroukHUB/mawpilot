/**
 * Valeurs d'énumération — miroir exact des types enum PostgreSQL
 * (voir supabase/migrations). Slugs stables sans accents ;
 * les libellés français sont dans src/lib/labels.ts.
 */

export const PROJECT_STATUSES = ["actif", "en_pause", "termine", "archive"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_CATEGORIES = [
  "developpement", "seo", "maintenance", "design", "commercial",
  "administratif", "logistique", "autre",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_STATUSES = [
  "backlog", "a_faire", "en_cours", "en_attente_client", "bloquee",
  "terminee", "archivee",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["faible", "normale", "haute", "urgente"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const BILLING_STATUSES = [
  "incluse", "supplementaire", "offerte", "a_facturer", "facturee",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const CREATION_SOURCES = ["manuelle", "ia_texte", "ia_voix"] as const;
export type CreationSource = (typeof CREATION_SOURCES)[number];
