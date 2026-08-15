import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/reports/print-button";
import { formatDateShort, formatMinutes } from "@/lib/dates";
import { buildSummaryTable } from "@/lib/reports/format";
import { formatPeriodLabel } from "@/lib/reports/periods";
import {
  reportSectionLabels,
  type ReportContent,
  type ReportFacts,
  type ReportSectionKey,
} from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Impression du rapport" };

function money(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}

export default async function PrintReportPage({
  params,
}: PageProps<"/rapports/[id]/impression">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("id, title, source_data, content")
    .eq("id", id)
    .single();

  if (!report) notFound();

  const facts = report.source_data as ReportFacts;
  const content = report.content as ReportContent;

  const included = (key: ReportSectionKey) =>
    content.sections.find((s) => s.key === key)?.included ?? false;
  const text = (key: ReportSectionKey) =>
    (content.sections.find((s) => s.key === key)?.text ?? "").trim();

  const table = buildSummaryTable(facts);

  return (
    <div className="mx-auto w-full max-w-3xl bg-white p-8 text-black print:max-w-none print:p-0">
      <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          Utilisez « Imprimer » puis choisissez « Enregistrer au format PDF ».
        </p>
        <PrintButton />
      </div>

      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <p className="text-sm text-neutral-600">
          {facts.companyName} — {formatPeriodLabel(facts.period)}
        </p>
      </header>

      {included("resume") && text("resume") ? (
        <Section title={reportSectionLabels.resume}>
          <p className="whitespace-pre-wrap">{text("resume")}</p>
        </Section>
      ) : null}

      {included("termine") && facts.completedTasks.length > 0 ? (
        <Section title={reportSectionLabels.termine}>
          <ul className="list-inside list-disc">
            {facts.completedTasks.map((t) => (
              <li key={t.id}>
                {t.title}
                {t.project_name ? ` (${t.project_name})` : ""}
                {t.minutes > 0 ? ` — ${formatMinutes(t.minutes)}` : ""}
              </li>
            ))}
          </ul>
          {text("termine") ? (
            <p className="mt-2 whitespace-pre-wrap">{text("termine")}</p>
          ) : null}
        </Section>
      ) : null}

      {included("en_cours") && facts.inProgressTasks.length > 0 ? (
        <Section title={reportSectionLabels.en_cours}>
          <ul className="list-inside list-disc">
            {facts.inProgressTasks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
          {text("en_cours") ? (
            <p className="mt-2 whitespace-pre-wrap">{text("en_cours")}</p>
          ) : null}
        </Section>
      ) : null}

      {included("resultats") &&
      (content.metrics.length > 0 || text("resultats")) ? (
        <Section title={reportSectionLabels.resultats}>
          <ul className="list-inside list-disc">
            {content.metrics.map((m, i) => (
              <li key={i}>
                {m.label} : {m.value}
              </li>
            ))}
          </ul>
          {text("resultats") ? (
            <p className="mt-2 whitespace-pre-wrap">{text("resultats")}</p>
          ) : null}
        </Section>
      ) : null}

      {included("blocages") &&
      (facts.blockedTasks.length > 0 ||
        facts.waitingClientTasks.length > 0 ||
        text("blocages")) ? (
        <Section title={reportSectionLabels.blocages}>
          <ul className="list-inside list-disc">
            {facts.blockedTasks.map((t) => (
              <li key={t.id}>{t.title} (bloquée)</li>
            ))}
            {facts.waitingClientTasks.map((t) => (
              <li key={t.id}>{t.title} (en attente de votre retour)</li>
            ))}
          </ul>
          {text("blocages") ? (
            <p className="mt-2 whitespace-pre-wrap">{text("blocages")}</p>
          ) : null}
        </Section>
      ) : null}

      {included("liens") &&
      (content.links.length > 0 || facts.documents.length > 0) ? (
        <Section title={reportSectionLabels.liens}>
          <ul className="list-inside list-disc">
            {content.links.map((l, i) => (
              <li key={i}>
                {l.label} —{" "}
                <span className="break-all text-neutral-700">{l.url}</span>
              </li>
            ))}
            {facts.documents.map((d) => (
              <li key={d.id}>
                {d.name}
                {d.external_url ? (
                  <>
                    {" — "}
                    <span className="break-all text-neutral-700">
                      {d.external_url}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {included("tableau") && table.rows.length > 0 ? (
        <Section title={reportSectionLabels.tableau}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {table.headers.map((h) => (
                    <th
                      key={h}
                      className="border border-neutral-300 bg-neutral-100 px-2 py-1 text-left font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="border border-neutral-300 px-2 py-1"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {included("temps") && facts.totals.totalMinutes > 0 ? (
        <Section title={reportSectionLabels.temps}>
          <p>Total : {formatMinutes(facts.totals.totalMinutes)}</p>
          {facts.totals.billableMinutes > 0 ? (
            <p>
              Dont facturable : {formatMinutes(facts.totals.billableMinutes)}
            </p>
          ) : null}
        </Section>
      ) : null}

      {included("prestations") && facts.unbilledTasks.length > 0 ? (
        <Section title={reportSectionLabels.prestations}>
          <ul className="list-inside list-disc">
            {facts.unbilledTasks.map((t) => (
              <li key={t.id}>
                {t.title}
                {t.amount !== null ? ` — ${money(t.amount)}` : ""}
              </li>
            ))}
          </ul>
          {facts.totals.unbilledAmount > 0 ? (
            <p className="mt-1 font-semibold">
              Total : {money(facts.totals.unbilledAmount)}
            </p>
          ) : null}
        </Section>
      ) : null}

      {included("prochaines_actions") &&
      (text("prochaines_actions") || facts.upcomingTasks.length > 0) ? (
        <Section title={reportSectionLabels.prochaines_actions}>
          {text("prochaines_actions") ? (
            <p className="mb-2 whitespace-pre-wrap">
              {text("prochaines_actions")}
            </p>
          ) : null}
          <ul className="list-inside list-disc">
            {facts.upcomingTasks.map((t) => (
              <li key={t.id}>
                {t.title}
                {t.due_date ? ` (échéance ${formatDateShort(t.due_date)})` : ""}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="mt-8 border-t pt-3 text-xs text-neutral-500">
        Rapport établi à partir des données enregistrées dans MAW Pilot by
        Farouk.
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-1.5 text-base font-semibold">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
