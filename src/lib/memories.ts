/**
 * Constantes de la mémoire d'entreprise.
 *
 * IMPORTANT — pourquoi ce fichier existe :
 * ces valeurs étaient exportées depuis `src/actions/memories.ts`, un module
 * marqué `"use server"`. Next.js n'envoie jamais ce code au navigateur : il
 * remplace chaque export d'un tel module par une référence d'appel distant,
 * c'est-à-dire une FONCTION. Un composant client recevait donc une fonction
 * au lieu d'un tableau, et `MEMORY_CATEGORIES.map(...)` échouait avec
 * « u.map is not a function ».
 *
 * Règle générale : tout ce qui n'est pas une fonction serveur doit vivre
 * dans un module neutre comme celui-ci. Le test `tests/server-boundaries.test.ts`
 * vérifie automatiquement que la règle est respectée dans tout le projet.
 */

export const MEMORY_CATEGORIES = [
  "contexte_client",
  "preference",
  "consigne",
  "technique",
  "commercial",
  "autre",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const memoryCategoryLabels: Record<MemoryCategory, string> = {
  contexte_client: "Contexte client",
  preference: "Préférence",
  consigne: "Consigne",
  technique: "Technique",
  commercial: "Commercial",
  autre: "Autre",
};

export const MEMORY_SOURCES = [
  "utilisateur",
  "ia_confirmee",
  "donnees",
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const memorySourceLabels: Record<MemorySource, string> = {
  utilisateur: "Vous",
  ia_confirmee: "Assistant (confirmé)",
  donnees: "Déduit des données",
};

export const MEMORY_STATUSES = ["confirmee", "a_verifier"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type MemoryRow = {
  id: string;
  company_id: string;
  content: string;
  category: MemoryCategory;
  source: MemorySource;
  status: MemoryStatus;
  is_archived: boolean;
  created_at: string;
};

/** Libellé sûr même si la base contient une valeur inattendue. */
export function memoryCategoryLabel(value: string): string {
  return memoryCategoryLabels[value as MemoryCategory] ?? value;
}

export function memorySourceLabel(value: string): string {
  return memorySourceLabels[value as MemorySource] ?? value;
}
