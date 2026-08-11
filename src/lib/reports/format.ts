import { formatDateShort, formatMinutes } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/reports/periods";
import {
  reportSectionLabels,
  type ReportContent,
  type ReportFacts,
  type ReportSectionKey,
} from "@/lib/reports/types";
import { billingStatusLabels } from "@/lib/labels";
import type { BillingStatus } from "@/lib/enums";

/**
 * Mise en forme des rapports — 100 % déterministe et testable.
 * Aucune de ces fonctions n'invente un fait : elles n'affichent que ce que
 * contiennent `facts` (données enregistrées) et `content` (texte rédigé).
 */

function money(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

function isIncluded(content: ReportContent, key: ReportSectionKey): boolean {
  return content.sections.find((s) => s.key === key)?.included ?? false;
}

function sectionText(content: ReportContent, key: ReportSectionKey): string {
  return (content.sections.find((s) => s.key === key)?.text ?? "").trim();
}

/**
 * Message WhatsApp court. WhatsApp met en gras avec des astérisques simples.
 * Pas de Markdown : ce texte est destiné à être collé tel quel.
 */
export function formatWhatsAppMessage(
  facts: ReportFacts,
  content: ReportContent
): string {
  const lines: string[] = [];

  lines.push(`*${facts.companyName} — ${formatPeriodLabel(facts.period)}*`);

  const resume = sectionText(content, "resume");
  if (isIncluded(content, "resume") && resume) {
    lines.push("", resume);
  }

  if (isIncluded(content, "termine") && facts.completedTasks.length > 0) {
    lines.push("", "*Terminé cette période*");
    for (const task of facts.completedTasks) {
      lines.push(`• ${task.title}`);
    }
    const text = sectionText(content, "termine");
    if (text) lines.push(text);
  }

  if (isIncluded(content, "en_cours") && facts.inProgressTasks.length > 0) {
    lines.push("", "*En cours*");
    for (const task of facts.inProgressTasks) {
      lines.push(`• ${task.title}`);
    }
    const text = sectionText(content, "en_cours");
    if (text) lines.push(text);
  }

  if (isIncluded(content, "resultats")) {
    const text = sectionText(content, "resultats");
    if (content.metrics.length > 0 || text) {
      lines.push("", "*Résultats*");
      for (const metric of content.metrics) {
        lines.push(`• ${metric.label} : ${metric.value}`);
      }
      if (text) lines.push(text);
    }
  }

  if (isIncluded(content, "blocages")) {
    const blockers = [...facts.blockedTasks, ...facts.waitingClientTasks];
    const text = sectionText(content, "blocages");
    if (blockers.length > 0 || text) {
      lines.push("", "*En attente / blocages*");
      for (const task of blockers) {
        const reason =
          task.status === "en_attente_client" ? "en attente de votre retour" : "bloquée";
        lines.push(`• ${task.title} (${reason})`);
      }
      if (text) lines.push(text);
    }
  }

  if (isIncluded(content, "liens")) {
    const links = [
      ...content.links,
      ...facts.documents
        .filter((d) => d.external_url)
        .map((d) => ({ label: d.name, url: d.external_url as string })),
    ];
    if (links.length > 0) {
      lines.push("", "*Liens*");
      for (const link of links) {
        lines.push(`• ${link.label} : ${link.url}`);
      }
    }
  }

  if (isIncluded(content, "temps") && facts.totals.totalMinutes > 0) {
    lines.push("", `*Temps passé* : ${formatMinutes(facts.totals.totalMinutes)}`);
  }

  if (isIncluded(content, "prestations") && facts.unbilledTasks.length > 0) {
    lines.push("", "*Prestations supplémentaires*");
    for (const task of facts.unbilledTasks) {
      lines.push(
        `• ${task.title}${task.amount !== null ? ` — ${money(task.amount)}` : ""}`
      );
    }
    if (facts.totals.unbilledAmount > 0) {
      lines.push(`Total : ${money(facts.totals.unbilledAmount)}`);
    }
  }

  if (isIncluded(content, "prochaines_actions")) {
    const text = sectionText(content, "prochaines_actions");
    if (text || facts.upcomingTasks.length > 0) {
      lines.push("", "*Prochaines actions*");
      if (text) lines.push(text);
      for (const task of facts.upcomingTasks.slice(0, 5)) {
        lines.push(
          `• ${task.title}${task.due_date ? ` (${formatDateShort(task.due_date)})` : ""}`
        );
      }
    }
  }

  return lines.join("\n").trim();
}

/** Version longue, structurée, pour le document imprimable et les exports. */
export function formatLongText(
  facts: ReportFacts,
  content: ReportContent
): string {
  const lines: string[] = [];

  lines.push(`${facts.companyName} — ${formatPeriodLabel(facts.period)}`);
  lines.push("");

  const push = (key: ReportSectionKey, body: string[]) => {
    if (!isIncluded(content, key) || body.length === 0) return;
    lines.push(reportSectionLabels[key].toUpperCase());
    lines.push(...body);
    lines.push("");
  };

  const resume = sectionText(content, "resume");
  push("resume", resume ? [resume] : []);

  push(
    "termine",
    [
      ...facts.completedTasks.map(
        (t) =>
          `- ${t.title}${t.project_name ? ` (${t.project_name})` : ""}${
            t.minutes > 0 ? ` — ${formatMinutes(t.minutes)}` : ""
          }`
      ),
      ...(sectionText(content, "termine") ? [sectionText(content, "termine")] : []),
    ]
  );

  push("en_cours", [
    ...facts.inProgressTasks.map((t) => `- ${t.title}`),
    ...(sectionText(content, "en_cours") ? [sectionText(content, "en_cours")] : []),
  ]);

  push("resultats", [
    ...content.metrics.map((m) => `- ${m.label} : ${m.value}`),
    ...(sectionText(content, "resultats") ? [sectionText(content, "resultats")] : []),
  ]);

  push("blocages", [
    ...facts.blockedTasks.map((t) => `- ${t.title} (bloquée)`),
    ...facts.waitingClientTasks.map((t) => `- ${t.title} (en attente client)`),
    ...(sectionText(content, "blocages") ? [sectionText(content, "blocages")] : []),
  ]);

  push("liens", [
    ...content.links.map((l) => `- ${l.label} : ${l.url}`),
    ...facts.documents.map(
      (d) => `- ${d.name}${d.external_url ? ` : ${d.external_url}` : ""}`
    ),
  ]);

  push(
    "temps",
    facts.totals.totalMinutes > 0
      ? [
          `Total : ${formatMinutes(facts.totals.totalMinutes)}`,
          ...(facts.totals.billableMinutes > 0
            ? [`Dont facturable : ${formatMinutes(facts.totals.billableMinutes)}`]
            : []),
        ]
      : []
  );

  push("prestations", [
    ...facts.unbilledTasks.map(
      (t) =>
        `- ${t.title} — ${billingStatusLabels[t.billing_status as BillingStatus] ?? t.billing_status}${
          t.amount !== null ? ` — ${money(t.amount)}` : ""
        }`
    ),
    ...(facts.totals.unbilledAmount > 0
      ? [`Total : ${money(facts.totals.unbilledAmount)}`]
      : []),
  ]);

  push("prochaines_actions", [
    ...(sectionText(content, "prochaines_actions")
      ? [sectionText(content, "prochaines_actions")]
      : []),
    ...facts.upcomingTasks.map(
      (t) => `- ${t.title}${t.due_date ? ` (échéance ${formatDateShort(t.due_date)})` : ""}`
    ),
  ]);

  return lines.join("\n").trim();
}

/** Tableau récapitulatif : en-têtes + lignes, utilisé pour le CSV et le DOCX. */
export function buildSummaryTable(facts: ReportFacts): {
  headers: string[];
  rows: string[][];
} {
  return {
    headers: [
      "Tâche",
      "Projet",
      "Statut",
      "Temps",
      "Facturation",
      "Montant",
      "Terminée le",
    ],
    rows: [
      ...facts.completedTasks,
      ...facts.inProgressTasks,
      ...facts.blockedTasks,
      ...facts.waitingClientTasks,
    ].map((t) => [
      t.title,
      t.project_name ?? "",
      t.status,
      t.minutes > 0 ? formatMinutes(t.minutes) : "",
      billingStatusLabels[t.billing_status as BillingStatus] ?? t.billing_status,
      t.amount !== null ? t.amount.toFixed(2).replace(".", ",") : "",
      t.completed_at ? formatDateShort(t.completed_at) : "",
    ]),
  };
}

/**
 * CSV conforme RFC 4180, encodé pour Excel français :
 * séparateur point-virgule + BOM UTF-8 (ajouté à l'écriture du fichier).
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => {
    const needsQuotes = /[";\n\r]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  return [headers, ...rows]
    .map((row) => row.map(escape).join(";"))
    .join("\r\n");
}
