/**
 * Structures d'un rapport.
 *
 * Distinction fondamentale :
 * - `ReportFacts` = données réellement enregistrées, assemblées par du code
 *   déterministe. Jamais produites par l'IA.
 * - `ReportContent` = sections rédigées (par l'utilisateur ou l'IA) à partir
 *   de ces faits. L'interface distingue toujours les deux.
 */

export type ReportPeriod = {
  start: string; // yyyy-MM-dd inclus
  end: string; // yyyy-MM-dd inclus
};

export type FactTask = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  billing_status: string;
  amount: number | null;
  due_date: string | null;
  completed_at: string | null;
  project_name: string | null;
  minutes: number;
};

export type FactTimeEntry = {
  id: string;
  entry_date: string;
  minutes: number;
  description: string | null;
  is_billable: boolean;
  task_title: string | null;
};

export type FactDocument = {
  id: string;
  name: string;
  type: string;
  external_url: string | null;
  created_at: string;
};

/** Faits enregistrés sur la période — la seule source de vérité du rapport. */
export type ReportFacts = {
  period: ReportPeriod;
  companyName: string;
  completedTasks: FactTask[];
  inProgressTasks: FactTask[];
  blockedTasks: FactTask[];
  waitingClientTasks: FactTask[];
  upcomingTasks: FactTask[];
  unbilledTasks: FactTask[];
  timeEntries: FactTimeEntry[];
  documents: FactDocument[];
  totals: {
    completedCount: number;
    totalMinutes: number;
    billableMinutes: number;
    unbilledAmount: number;
  };
};

export const REPORT_SECTION_KEYS = [
  "resume",
  "termine",
  "en_cours",
  "resultats",
  "blocages",
  "liens",
  "tableau",
  "temps",
  "prestations",
  "prochaines_actions",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export const reportSectionLabels: Record<ReportSectionKey, string> = {
  resume: "Résumé de la semaine",
  termine: "Travail terminé",
  en_cours: "Travail en cours",
  resultats: "Résultats et indicateurs",
  blocages: "Blocages et attente client",
  liens: "Liens et livrables",
  tableau: "Tableau récapitulatif",
  temps: "Temps passé",
  prestations: "Prestations supplémentaires",
  prochaines_actions: "Prochaines actions",
};

/** Sections retenues et texte associé. */
export type ReportSection = {
  key: ReportSectionKey;
  included: boolean;
  /** Texte rédigé. Vide = la section n'affiche que les faits. */
  text: string;
};

export type ReportContent = {
  sections: ReportSection[];
  /** Indicateurs saisis à la main (Search Console, Analytics…). */
  metrics: { label: string; value: string }[];
  /** URL ajoutées manuellement au rapport. */
  links: { label: string; url: string }[];
};

export function defaultReportContent(): ReportContent {
  return {
    sections: REPORT_SECTION_KEYS.map((key) => ({
      key,
      included: key !== "resultats",
      text: "",
    })),
    metrics: [],
    links: [],
  };
}
