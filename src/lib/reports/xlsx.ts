import writeXlsxFile from "write-excel-file/node";

import { formatMinutes } from "@/lib/dates";
import { buildSummaryTable } from "@/lib/reports/format";
import { formatPeriodLabel } from "@/lib/reports/periods";
import type { ReportContent, ReportFacts } from "@/lib/reports/types";

/**
 * Export XLSX d'un rapport.
 *
 * Contrairement au CSV, le tableur porte la mise en forme (en-têtes,
 * largeurs, types) et plusieurs feuilles. Les valeurs numériques sont
 * exportées comme des NOMBRES, pas comme du texte : le client peut donc
 * calculer dessus directement.
 */

type Cell = {
  // `undefined` laisse la cellule vide ; `null` n'est pas accepté.
  value?: string | number;
  type?: typeof String | typeof Number;
  fontWeight?: "bold";
  align?: "left" | "right";
  backgroundColor?: string;
  color?: string;
};

type Row = Cell[];

const HEADER_STYLE = {
  fontWeight: "bold" as const,
  backgroundColor: "#111111",
  color: "#FFFFFF",
};

function headerRow(labels: string[]): Row {
  return labels.map((value) => ({ value, type: String, ...HEADER_STYLE }));
}

/** Convertit « 1 234,56 » en nombre ; cellule vide si la valeur est absente. */
function toNumber(value: string): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function buildReportXlsx(
  title: string,
  facts: ReportFacts,
  content: ReportContent
): Promise<Buffer> {
  // --- Feuille 1 : synthèse -------------------------------------------------
  const summary: Row[] = [
    [{ value: title, type: String, fontWeight: "bold" }],
    [
      {
        value: `${facts.companyName} — ${formatPeriodLabel(facts.period)}`,
        type: String,
      },
    ],
    [],
    headerRow(["Indicateur", "Valeur"]),
    [
      { value: "Tâches terminées", type: String },
      { value: facts.totals.completedCount, type: Number },
    ],
    [
      { value: "Temps passé", type: String },
      { value: formatMinutes(facts.totals.totalMinutes), type: String },
    ],
    [
      { value: "Dont facturable", type: String },
      { value: formatMinutes(facts.totals.billableMinutes), type: String },
    ],
    [
      { value: "Prestations à facturer (€)", type: String },
      { value: facts.totals.unbilledAmount, type: Number },
    ],
  ];

  // Indicateurs saisis à la main (Search Console, Analytics…).
  if (content.metrics.length > 0) {
    summary.push([], headerRow(["Indicateur relevé", "Valeur"]));
    for (const metric of content.metrics) {
      summary.push([
        { value: metric.label, type: String },
        { value: metric.value, type: String },
      ]);
    }
  }

  // --- Feuille 2 : détail des tâches ---------------------------------------
  const table = buildSummaryTable(facts);
  const details: Row[] = [headerRow(table.headers)];

  for (const row of table.rows) {
    details.push([
      { value: row[0], type: String },
      { value: row[1], type: String },
      { value: row[2], type: String },
      { value: row[3], type: String },
      { value: row[4], type: String },
      // Le montant part en nombre : le client peut sommer la colonne.
      { value: toNumber(row[5]), type: Number, align: "right" },
      { value: row[6], type: String },
    ]);
  }

  // --- Feuille 3 : temps passé ---------------------------------------------
  const times: Row[] = [
    headerRow(["Date", "Tâche", "Durée (min)", "Facturable", "Description"]),
  ];
  for (const entry of facts.timeEntries) {
    times.push([
      { value: entry.entry_date, type: String },
      { value: entry.task_title ?? "", type: String },
      { value: entry.minutes, type: Number, align: "right" },
      { value: entry.is_billable ? "Oui" : "Non", type: String },
      { value: entry.description ?? "", type: String },
    ]);
  }

  // Plusieurs feuilles : la bibliothèque attend des objets { data, name },
  // pas un tableau de tableaux.
  const sheets = [
    {
      name: "Synthèse",
      data: summary,
      columns: [{ width: 34 }, { width: 22 }],
    },
    {
      name: "Détail",
      data: details,
      columns: [
        { width: 46 },
        { width: 22 },
        { width: 18 },
        { width: 12 },
        { width: 18 },
        { width: 12 },
        { width: 14 },
      ],
    },
    {
      name: "Temps",
      data: times,
      columns: [
        { width: 14 },
        { width: 40 },
        { width: 14 },
        { width: 12 },
        { width: 46 },
      ],
    },
  ];

  // La variante Node renvoie un objet exposant toBuffer()/toStream()/toFile(),
  // pas un Buffer directement.
  const output = (await writeXlsxFile(sheets)) as unknown as {
    toBuffer: () => Promise<Buffer>;
  };

  return output.toBuffer();
}
