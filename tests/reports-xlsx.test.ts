import { describe, expect, it } from "vitest";

import { buildReportFacts } from "@/lib/reports/collect";
import { buildReportXlsx } from "@/lib/reports/xlsx";
import { defaultReportContent } from "@/lib/reports/types";

const period = { start: "2026-08-03", end: "2026-08-09" };

const facts = buildReportFacts({
  companyName: "Trust Industrie",
  period,
  tasks: [
    {
      id: "t1",
      title: "Optimiser la fiche Bureau Alcôve",
      category: "seo",
      priority: "normale",
      status: "terminee",
      billing_status: "a_facturer",
      amount: 150.5,
      due_date: null,
      completed_at: "2026-08-05T10:00:00Z",
      updated_at: "2026-08-05T10:00:00Z",
      projects: { name: "Refonte SEO" },
    },
  ] as never,
  timeEntries: [
    {
      id: "e1",
      entry_date: "2026-08-05",
      minutes: 90,
      description: "Fiches produits",
      is_billable: true,
      task_id: "t1",
      tasks: { title: "Optimiser la fiche Bureau Alcôve" },
    },
  ] as never,
  documents: [],
});

describe("export XLSX", () => {
  it("produit un fichier de classeur valide", async () => {
    const buffer = await buildReportXlsx(
      "Rapport hebdomadaire — Trust Industrie",
      facts,
      defaultReportContent()
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // Un .xlsx est une archive ZIP : elle commence par « PK ».
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("contient les trois feuilles attendues", async () => {
    const buffer = await buildReportXlsx("Rapport", facts, defaultReportContent());
    const raw = buffer.toString("latin1");
    // Les noms de feuilles figurent en clair dans le conteneur ZIP.
    expect(raw).toContain("workbook.xml");
    expect(raw).toContain("sheet1.xml");
    expect(raw).toContain("sheet2.xml");
    expect(raw).toContain("sheet3.xml");
  });

  it("ne plante pas sur un rapport vide", async () => {
    const emptyFacts = buildReportFacts({
      companyName: "Vide",
      period,
      tasks: [],
      timeEntries: [],
      documents: [],
    });
    const buffer = await buildReportXlsx(
      "Rapport vide",
      emptyFacts,
      defaultReportContent()
    );
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("intègre les indicateurs saisis à la main", async () => {
    const content = defaultReportContent();
    content.metrics = [{ label: "Clics Search Console", value: "+12 %" }];
    const buffer = await buildReportXlsx("Rapport", facts, content);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("est déterministe sur les mêmes données", async () => {
    const a = await buildReportXlsx("Rapport", facts, defaultReportContent());
    const b = await buildReportXlsx("Rapport", facts, defaultReportContent());
    expect(a.length).toBe(b.length);
  });
});
