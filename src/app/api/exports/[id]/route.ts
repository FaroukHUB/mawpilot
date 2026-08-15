import { NextResponse, type NextRequest } from "next/server";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { formatDateShort, formatMinutes } from "@/lib/dates";
import { buildCsv, buildSummaryTable } from "@/lib/reports/format";
import { formatPeriodLabel } from "@/lib/reports/periods";
import {
  reportSectionLabels,
  type ReportContent,
  type ReportFacts,
  type ReportSectionKey,
} from "@/lib/reports/types";
import { buildReportXlsx } from "@/lib/reports/xlsx";
import { sanitizeFileName } from "@/lib/validations/documents";
import { createClient } from "@/lib/supabase/server";

/**
 * Exports de rapport : /api/exports/<id>?format=docx|csv
 * Le PDF passe par la vue imprimable (/rapports/<id>/impression) : impression
 * native du navigateur, identique sur ordinateur et mobile — voir D-018.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "docx";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: report } = await supabase
    .from("reports")
    .select("id, title, source_data, content, long_text")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });
  }

  const facts = report.source_data as ReportFacts;
  const content = report.content as ReportContent;
  const baseName = sanitizeFileName(report.title);

  if (format === "csv") {
    const { headers, rows } = buildSummaryTable(facts);
    // BOM UTF-8 : Excel ouvre correctement les accents.
    const body = "﻿" + buildCsv(headers, rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await buildReportXlsx(report.title, facts, content);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "docx") {
    const buffer = await buildDocx(report.title, facts, content);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "Format non supporté." }, { status: 400 });
}

function isIncluded(content: ReportContent, key: ReportSectionKey): boolean {
  return content.sections.find((s) => s.key === key)?.included ?? false;
}

function sectionText(content: ReportContent, key: ReportSectionKey): string {
  return (content.sections.find((s) => s.key === key)?.text ?? "").trim();
}

async function buildDocx(
  title: string,
  facts: ReportFacts,
  content: ReportContent
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${facts.companyName} — ${formatPeriodLabel(facts.period)}`,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ text: "" })
  );

  const heading = (key: ReportSectionKey) =>
    new Paragraph({
      text: reportSectionLabels[key],
      heading: HeadingLevel.HEADING_2,
    });

  const bullet = (text: string) =>
    new Paragraph({ text, bullet: { level: 0 } });

  const addSection = (key: ReportSectionKey, body: Paragraph[]) => {
    if (!isIncluded(content, key) || body.length === 0) return;
    children.push(heading(key), ...body, new Paragraph({ text: "" }));
  };

  const resume = sectionText(content, "resume");
  addSection("resume", resume ? [new Paragraph({ text: resume })] : []);

  addSection("termine", [
    ...facts.completedTasks.map((t) =>
      bullet(
        `${t.title}${t.project_name ? ` (${t.project_name})` : ""}${
          t.minutes > 0 ? ` — ${formatMinutes(t.minutes)}` : ""
        }`
      )
    ),
    ...(sectionText(content, "termine")
      ? [new Paragraph({ text: sectionText(content, "termine") })]
      : []),
  ]);

  addSection("en_cours", [
    ...facts.inProgressTasks.map((t) => bullet(t.title)),
    ...(sectionText(content, "en_cours")
      ? [new Paragraph({ text: sectionText(content, "en_cours") })]
      : []),
  ]);

  addSection("resultats", [
    ...content.metrics.map((m) => bullet(`${m.label} : ${m.value}`)),
    ...(sectionText(content, "resultats")
      ? [new Paragraph({ text: sectionText(content, "resultats") })]
      : []),
  ]);

  addSection("blocages", [
    ...facts.blockedTasks.map((t) => bullet(`${t.title} (bloquée)`)),
    ...facts.waitingClientTasks.map((t) => bullet(`${t.title} (attente client)`)),
    ...(sectionText(content, "blocages")
      ? [new Paragraph({ text: sectionText(content, "blocages") })]
      : []),
  ]);

  addSection("liens", [
    ...content.links.map((l) => bullet(`${l.label} : ${l.url}`)),
    ...facts.documents.map((d) =>
      bullet(`${d.name}${d.external_url ? ` : ${d.external_url}` : ""}`)
    ),
  ]);

  // Tableau récapitulatif
  if (isIncluded(content, "tableau")) {
    const { headers, rows } = buildSummaryTable(facts);
    if (rows.length > 0) {
      children.push(heading("tableau"));
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: headers.map(
                (h) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: h, bold: true })],
                      }),
                    ],
                  })
              ),
            }),
            ...rows.map(
              (row) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [new Paragraph({ text: cell })],
                      })
                  ),
                })
            ),
          ],
        })
      );
      children.push(new Paragraph({ text: "" }));
    }
  }

  addSection(
    "temps",
    facts.totals.totalMinutes > 0
      ? [
          new Paragraph({
            text: `Total : ${formatMinutes(facts.totals.totalMinutes)}`,
          }),
          ...(facts.totals.billableMinutes > 0
            ? [
                new Paragraph({
                  text: `Dont facturable : ${formatMinutes(facts.totals.billableMinutes)}`,
                }),
              ]
            : []),
        ]
      : []
  );

  addSection("prestations", [
    ...facts.unbilledTasks.map((t) =>
      bullet(
        `${t.title}${t.amount !== null ? ` — ${t.amount.toFixed(2).replace(".", ",")} €` : ""}`
      )
    ),
    ...(facts.totals.unbilledAmount > 0
      ? [
          new Paragraph({
            text: `Total : ${facts.totals.unbilledAmount.toFixed(2).replace(".", ",")} €`,
          }),
        ]
      : []),
  ]);

  addSection("prochaines_actions", [
    ...(sectionText(content, "prochaines_actions")
      ? [new Paragraph({ text: sectionText(content, "prochaines_actions") })]
      : []),
    ...facts.upcomingTasks.map((t) =>
      bullet(
        `${t.title}${t.due_date ? ` (échéance ${formatDateShort(t.due_date)})` : ""}`
      )
    ),
  ]);

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "Rapport établi à partir des données enregistrées dans MAW Pilot.",
          italics: true,
          size: 16,
        }),
      ],
    })
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
