import { describe, expect, it } from "vitest";

import { buildReportFacts } from "@/lib/reports/collect";
import {
  buildCsv,
  buildSummaryTable,
  formatLongText,
  formatWhatsAppMessage,
} from "@/lib/reports/format";
import {
  buildReportTitle,
  formatPeriodLabel,
  lastWeekPeriod,
} from "@/lib/reports/periods";
import { defaultReportContent, type ReportContent } from "@/lib/reports/types";

const period = { start: "2026-08-03", end: "2026-08-09" };

function task(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "t1",
    title: "Optimiser la fiche Bureau Alcôve",
    category: "seo",
    priority: "normale",
    status: "terminee",
    billing_status: "incluse",
    amount: null,
    due_date: null,
    completed_at: "2026-08-05T10:00:00Z",
    updated_at: "2026-08-05T10:00:00Z",
    projects: null,
    ...over,
  } as never;
}

function entry(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e1",
    entry_date: "2026-08-05",
    minutes: 120,
    description: "Fiches produits",
    is_billable: false,
    task_id: "t1",
    tasks: { title: "Optimiser la fiche Bureau Alcôve" },
    ...over,
  } as never;
}

const emptyInput = {
  companyName: "Trust Industrie",
  period,
  tasks: [],
  timeEntries: [],
  documents: [],
};

describe("buildReportFacts — n'invente jamais un fait", () => {
  it("ne produit rien quand il n'y a aucune donnée", () => {
    const facts = buildReportFacts(emptyInput);
    expect(facts.completedTasks).toEqual([]);
    expect(facts.timeEntries).toEqual([]);
    expect(facts.totals.completedCount).toBe(0);
    expect(facts.totals.totalMinutes).toBe(0);
    expect(facts.totals.unbilledAmount).toBe(0);
  });

  it("ne retient que les tâches terminées DANS la période", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [
        task({ id: "dans", completed_at: "2026-08-05T10:00:00Z" }),
        task({ id: "avant", completed_at: "2026-07-30T10:00:00Z" }),
        task({ id: "apres", completed_at: "2026-08-12T10:00:00Z" }),
      ],
    });
    expect(facts.completedTasks.map((t) => t.id)).toEqual(["dans"]);
  });

  it("inclut les bornes de période (premier et dernier jour)", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [
        task({ id: "debut", completed_at: "2026-08-03T08:00:00Z" }),
        task({ id: "fin", completed_at: "2026-08-09T23:00:00Z" }),
      ],
    });
    expect(facts.completedTasks.map((t) => t.id).sort()).toEqual([
      "debut",
      "fin",
    ]);
  });

  it("ne compte que le temps de la période et l'agrège par tâche", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [task()],
      timeEntries: [
        entry({ id: "a", minutes: 60, entry_date: "2026-08-04" }),
        entry({ id: "b", minutes: 30, entry_date: "2026-08-05" }),
        entry({ id: "hors", minutes: 999, entry_date: "2026-07-01" }),
      ],
    });
    expect(facts.totals.totalMinutes).toBe(90);
    expect(facts.completedTasks[0].minutes).toBe(90);
  });

  it("distingue le temps facturable", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      timeEntries: [
        entry({ id: "a", minutes: 60, is_billable: true }),
        entry({ id: "b", minutes: 30, is_billable: false }),
      ],
    });
    expect(facts.totals.totalMinutes).toBe(90);
    expect(facts.totals.billableMinutes).toBe(60);
  });

  it("classe les tâches par statut", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [
        task({ id: "c", status: "en_cours", completed_at: null }),
        task({ id: "b", status: "bloquee", completed_at: null }),
        task({ id: "w", status: "en_attente_client", completed_at: null }),
      ],
    });
    expect(facts.inProgressTasks.map((t) => t.id)).toEqual(["c"]);
    expect(facts.blockedTasks.map((t) => t.id)).toEqual(["b"]);
    expect(facts.waitingClientTasks.map((t) => t.id)).toEqual(["w"]);
  });

  it("totalise les prestations à facturer", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [
        task({ id: "a", billing_status: "a_facturer", amount: 150 }),
        task({ id: "b", billing_status: "supplementaire", amount: 300.5 }),
        task({ id: "c", billing_status: "incluse", amount: 999 }),
      ],
    });
    expect(facts.unbilledTasks.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(facts.totals.unbilledAmount).toBe(450.5);
  });

  it("ne retient comme « à venir » que les échéances après la période", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [
        task({ id: "futur", status: "a_faire", completed_at: null, due_date: "2026-08-14" }),
        task({ id: "passe", status: "a_faire", completed_at: null, due_date: "2026-08-05" }),
        task({ id: "finie", status: "terminee", due_date: "2026-08-20" }),
      ],
    });
    expect(facts.upcomingTasks.map((t) => t.id)).toEqual(["futur"]);
  });

  it("est déterministe : deux appels identiques donnent le même résultat", () => {
    const input = {
      ...emptyInput,
      tasks: [task(), task({ id: "t2", status: "en_cours", completed_at: null })],
      timeEntries: [entry()],
    };
    expect(JSON.stringify(buildReportFacts(input))).toBe(
      JSON.stringify(buildReportFacts(input))
    );
  });
});

describe("formatWhatsAppMessage", () => {
  const content = defaultReportContent();

  it("mentionne l'entreprise et la période", () => {
    const facts = buildReportFacts(emptyInput);
    const message = formatWhatsAppMessage(facts, content);
    expect(message).toContain("Trust Industrie");
    expect(message).toContain("du 3 au 9 août 2026");
  });

  it("liste les tâches terminées et le temps", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [task()],
      timeEntries: [entry({ minutes: 150 })],
    });
    const message = formatWhatsAppMessage(facts, content);
    expect(message).toContain("Optimiser la fiche Bureau Alcôve");
    expect(message).toContain("2 h 30");
  });

  it("n'affiche pas une section décochée", () => {
    const facts = buildReportFacts({ ...emptyInput, tasks: [task()] });
    const withoutDone: ReportContent = {
      ...content,
      sections: content.sections.map((s) =>
        s.key === "termine" ? { ...s, included: false } : s
      ),
    };
    expect(formatWhatsAppMessage(facts, withoutDone)).not.toContain(
      "Optimiser la fiche Bureau Alcôve"
    );
  });

  it("n'invente aucune section quand il n'y a pas de données", () => {
    const message = formatWhatsAppMessage(buildReportFacts(emptyInput), content);
    expect(message).not.toContain("Terminé cette période");
    expect(message).not.toContain("En cours");
    expect(message).not.toContain("Temps passé");
  });

  it("inclut les indicateurs saisis manuellement", () => {
    const facts = buildReportFacts(emptyInput);
    const withMetrics: ReportContent = {
      ...content,
      sections: content.sections.map((s) =>
        s.key === "resultats" ? { ...s, included: true } : s
      ),
      metrics: [{ label: "Clics Search Console", value: "+12 %" }],
    };
    const message = formatWhatsAppMessage(facts, withMetrics);
    expect(message).toContain("Clics Search Console : +12 %");
  });

  it("est déterministe", () => {
    const facts = buildReportFacts({ ...emptyInput, tasks: [task()] });
    expect(formatWhatsAppMessage(facts, content)).toBe(
      formatWhatsAppMessage(facts, content)
    );
  });
});

describe("formatLongText", () => {
  it("reprend les faits enregistrés", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [task({ billing_status: "a_facturer", amount: 200 })],
      timeEntries: [entry({ minutes: 60 })],
    });
    const text = formatLongText(facts, defaultReportContent());
    expect(text).toContain("TRAVAIL TERMINÉ");
    expect(text).toContain("200,00 €");
    expect(text).toContain("1 h");
  });
});

describe("buildSummaryTable et buildCsv", () => {
  it("produit une ligne par tâche avec les bons en-têtes", () => {
    const facts = buildReportFacts({
      ...emptyInput,
      tasks: [task(), task({ id: "t2", status: "en_cours", completed_at: null })],
    });
    const { headers, rows } = buildSummaryTable(facts);
    expect(headers[0]).toBe("Tâche");
    expect(rows).toHaveLength(2);
  });

  it("échappe les guillemets et les points-virgules", () => {
    const csv = buildCsv(
      ["A", "B"],
      [['Il a dit "oui"', "un;deux"], ["ligne\nsuite", "simple"]]
    );
    expect(csv).toContain('"Il a dit ""oui"""');
    expect(csv).toContain('"un;deux"');
    expect(csv).toContain('"ligne\nsuite"');
  });

  it("sépare par point-virgule (Excel français)", () => {
    expect(buildCsv(["A", "B"], [["1", "2"]])).toBe("A;B\r\n1;2");
  });
});

describe("périodes", () => {
  it("calcule une semaine du lundi au dimanche", () => {
    // 2026-08-11 est un mardi : la semaine dernière va du 3 au 9 août.
    const p = lastWeekPeriod(new Date("2026-08-11T12:00:00Z"));
    expect(p).toEqual({ start: "2026-08-03", end: "2026-08-09" });
  });

  it("affiche un mois complet par son nom", () => {
    expect(formatPeriodLabel({ start: "2026-08-01", end: "2026-08-31" })).toBe(
      "août 2026"
    );
  });

  it("affiche une période courte lisiblement", () => {
    expect(formatPeriodLabel(period)).toBe("du 3 au 9 août 2026");
  });

  it("construit un titre explicite", () => {
    expect(buildReportTitle("hebdomadaire", "Trust Industrie", period)).toBe(
      "Rapport hebdomadaire — Trust Industrie (du 3 au 9 août 2026)"
    );
  });
});
