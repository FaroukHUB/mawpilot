import { describe, expect, it, vi } from "vitest";

import {
  buildToolDefinitions,
  isReadFunction,
  isWriteFunction,
  READ_FUNCTION_NAMES,
  validateFunctionArguments,
  WRITE_FUNCTION_NAMES,
} from "@/lib/ai/functions";
import {
  defaultDescribeAction,
  MAX_ROUNDS,
  runInterpretation,
  type ModelTurn,
} from "@/lib/ai/interpret";
import { buildRollingSummary, buildSystemPrompt } from "@/lib/ai/context";

const COMPANY_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const TASK_ID = "1c8f6d0e-2a4b-4c9d-8e7f-0a1b2c3d4e5f";

/** Fabrique une réponse simulée du modèle. */
function turn(
  text: string,
  calls: { name: string; args: unknown }[] = []
): ModelTurn {
  return {
    text,
    functionCalls: calls.map((c, i) => ({
      callId: `call_${i}`,
      name: c.name,
      argumentsJson: JSON.stringify(c.args),
    })),
  };
}

const noReads = vi.fn(async () => ({}));

describe("catalogue de fonctions", () => {
  it("sépare strictement lecture et écriture", () => {
    for (const name of READ_FUNCTION_NAMES) {
      expect(isReadFunction(name)).toBe(true);
      expect(isWriteFunction(name)).toBe(false);
    }
    for (const name of WRITE_FUNCTION_NAMES) {
      expect(isWriteFunction(name)).toBe(true);
      expect(isReadFunction(name)).toBe(false);
    }
  });

  it("expose toutes les fonctions du cahier des charges", () => {
    const all = [...READ_FUNCTION_NAMES, ...WRITE_FUNCTION_NAMES];
    for (const required of [
      "create_company",
      "create_project",
      "create_task",
      "update_task",
      "complete_task",
      "reopen_task",
      "log_time",
      "search_tasks",
      "get_company_summary",
      "get_overdue_tasks",
      "get_unbilled_work",
      "attach_company_document",
      "add_company_resource",
      "search_company_resources",
      "search_company_memories",
      "save_company_memory",
    ]) {
      expect(all).toContain(required);
    }
  });

  it("produit des définitions d'outils exploitables", () => {
    const tools = buildToolDefinitions();
    expect(tools.length).toBe(
      READ_FUNCTION_NAMES.length + WRITE_FUNCTION_NAMES.length
    );
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toHaveProperty("type", "object");
    }
  });
});

describe("validateFunctionArguments", () => {
  it("refuse une fonction inconnue", () => {
    const result = validateFunctionArguments("drop_database", {});
    expect(result.ok).toBe(false);
  });

  it("refuse une tâche sans entreprise", () => {
    const result = validateFunctionArguments("create_task", { title: "X" });
    expect(result.ok).toBe(false);
  });

  it("refuse un identifiant qui n'est pas un UUID", () => {
    const result = validateFunctionArguments("create_task", {
      company_id: "Trust Industrie",
      title: "X",
    });
    expect(result.ok).toBe(false);
  });

  it("refuse un statut ou une priorité hors énumération", () => {
    expect(
      validateFunctionArguments("create_task", {
        company_id: COMPANY_ID,
        title: "X",
        status: "fini",
      }).ok
    ).toBe(false);
    expect(
      validateFunctionArguments("create_task", {
        company_id: COMPANY_ID,
        title: "X",
        priority: "critique",
      }).ok
    ).toBe(false);
  });

  it("refuse une durée nulle, négative ou aberrante", () => {
    for (const minutes of [0, -30, 5000]) {
      expect(
        validateFunctionArguments("log_time", {
          company_id: COMPANY_ID,
          minutes,
        }).ok
      ).toBe(false);
    }
  });

  it("refuse une URL invalide pour un accès rapide", () => {
    expect(
      validateFunctionArguments("add_company_resource", {
        company_id: COMPANY_ID,
        label: "Site",
        url: "pas-une-url",
      }).ok
    ).toBe(false);
  });

  it("accepte une tâche correctement formée", () => {
    const result = validateFunctionArguments("create_task", {
      company_id: COMPANY_ID,
      title: "Optimiser la fiche Bureau Alcôve",
      priority: "urgente",
      due_date: "2026-08-14",
    });
    expect(result.ok).toBe(true);
  });
});

describe("runInterpretation — les écritures ne sont jamais exécutées", () => {
  it("propose une création de tâche sans rien écrire", async () => {
    const callModel = vi.fn(async () =>
      turn("Je propose d'ajouter cette tâche.", [
        {
          name: "create_task",
          args: {
            company_id: COMPANY_ID,
            title: "Optimiser la fiche Bureau Alcôve",
            priority: "urgente",
            due_date: "2026-08-14",
          },
        },
      ])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "Ajoute pour Trust Industrie : optimiser la fiche…",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0].name).toBe("create_task");
    expect(result.proposedActions[0].description).toContain(
      "Optimiser la fiche Bureau Alcôve"
    );
    // Une seule interrogation du modèle : la boucle s'arrête sur une écriture.
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it("exécute les lectures puis renvoie leurs résultats au modèle", async () => {
    const executeRead = vi.fn(async () => [
      { id: TASK_ID, titre: "Fiche produit", echeance: "2026-08-01" },
    ]);
    const callModel = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValueOnce(
        turn("", [{ name: "get_overdue_tasks", args: {} }])
      )
      .mockResolvedValueOnce(turn("Vous avez 1 tâche en retard."));

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "Montre-moi tout ce qui est en retard.",
      callModel,
      executeRead,
    });

    expect(executeRead).toHaveBeenCalledWith("get_overdue_tasks", {});
    expect(result.message).toBe("Vous avez 1 tâche en retard.");
    expect(result.proposedActions).toEqual([]);

    // Le second appel reçoit bien le résultat de la lecture.
    const secondCall = callModel.mock.calls[1] as unknown as [
      { toolResults: { name: string }[] },
    ];
    expect(secondCall[0].toolResults[0].name).toBe("get_overdue_tasks");
  });

  it("ignore une fonction inventée par le modèle", async () => {
    const callModel = vi.fn(async () =>
      turn("", [{ name: "delete_everything", args: {} }])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "Supprime tout",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toEqual([]);
    expect(result.issues.join(" ")).toContain("delete_everything");
  });

  it("signale des arguments invalides au lieu de les proposer", async () => {
    const callModel = vi.fn(async () =>
      turn("", [
        {
          name: "log_time",
          args: { company_id: COMPANY_ID, minutes: -60 },
        },
      ])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "Enregistre -1 heure",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("log_time");
  });

  it("résiste à des arguments JSON illisibles", async () => {
    const callModel = vi.fn(async () => ({
      text: "",
      functionCalls: [
        {
          callId: "c1",
          name: "create_task",
          argumentsJson: "{ ceci n'est pas du JSON",
        },
      ],
    }));

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "…",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toEqual([]);
    expect(result.issues[0]).toContain("illisibles");
  });

  it("propose plusieurs actions d'un même tour", async () => {
    const callModel = vi.fn(async () =>
      turn("Voici ce que je propose.", [
        { name: "complete_task", args: { task_id: TASK_ID } },
        {
          name: "log_time",
          args: { company_id: COMPANY_ID, minutes: 120 },
        },
      ])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage:
        "J'ai terminé les trois fiches produits et j'ai travaillé deux heures.",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions.map((a) => a.name)).toEqual([
      "complete_task",
      "log_time",
    ]);
  });

  it("s'arrête après un nombre borné d'allers-retours", async () => {
    const callModel = vi.fn(async () =>
      turn("", [{ name: "search_tasks", args: {} }])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "boucle",
      callModel,
      executeRead: noReads,
    });

    expect(callModel).toHaveBeenCalledTimes(MAX_ROUNDS);
    expect(result.issues.join(" ")).toContain("limite");
  });

  it("laisse passer une simple réponse sans action", async () => {
    const callModel = vi.fn(async () =>
      turn("Quelle entreprise exactement ? Vous en avez deux.")
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "Ajoute une tâche",
      callModel,
      executeRead: noReads,
    });

    expect(result.message).toContain("Quelle entreprise");
    expect(result.proposedActions).toEqual([]);
  });
});

describe("defaultDescribeAction", () => {
  it("décrit les actions en français lisible", () => {
    expect(
      defaultDescribeAction("create_task", {
        title: "Fiche produit",
        priority: "urgente",
        due_date: "2026-08-14",
      })
    ).toBe(
      "Créer la tâche « Fiche produit », priorité urgente, échéance 2026-08-14"
    );
    expect(defaultDescribeAction("log_time", { minutes: 120 })).toBe(
      "Enregistrer 120 minutes"
    );
    expect(defaultDescribeAction("complete_task", {})).toBe(
      "Marquer la tâche comme terminée"
    );
  });
});

describe("buildSystemPrompt", () => {
  const base = {
    userName: "Farouk",
    companies: [{ id: COMPANY_ID, name: "Trust Industrie" }],
    companyScope: null,
    summary: null,
    memories: [],
  };

  it("rappelle les règles de sécurité et d'ambiguïté", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("DEMANDE une précision");
    expect(prompt).toContain("n'inventes jamais");
    expect(prompt).toContain("save_company_memory");
    expect(prompt).toContain("Europe/Paris");
  });

  it("liste les entreprises avec leurs identifiants", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain(`Trust Industrie : ${COMPANY_ID}`);
  });

  it("cible une entreprise quand la conversation lui est dédiée", () => {
    const prompt = buildSystemPrompt({
      ...base,
      companyScope: { id: COMPANY_ID, name: "Trust Industrie" },
    });
    expect(prompt).toContain("PÉRIMÈTRE");
    expect(prompt).toContain(COMPANY_ID);
  });

  it("inclut les consignes durables et signale celles à vérifier", () => {
    const prompt = buildSystemPrompt({
      ...base,
      memories: [
        {
          content: "Rapport le vendredi avant 17 h",
          category: "consigne",
          status: "confirmee",
        },
        {
          content: "Le site tourne sous Shopify",
          category: "technique",
          status: "a_verifier",
        },
      ],
    });
    expect(prompt).toContain("Rapport le vendredi avant 17 h");
    expect(prompt).toContain("(à vérifier)");
  });
});

describe("buildRollingSummary", () => {
  it("ne change rien quand aucun message n'est écarté", () => {
    expect(buildRollingSummary("résumé", [])).toBe("résumé");
  });

  it("condense les anciens messages utilisateur", () => {
    const summary = buildRollingSummary(null, [
      { role: "user", content: "Ajoute une tâche pour Trust" },
      { role: "assistant", content: "C'est fait" },
    ]);
    expect(summary).toContain("Ajoute une tâche pour Trust");
    expect(summary).not.toContain("C'est fait");
  });

  it("borne la taille du résumé", () => {
    const long = Array.from({ length: 200 }, (_, i) => ({
      role: "user",
      content: `message numéro ${i} `.repeat(10),
    }));
    const summary = buildRollingSummary(null, long);
    expect((summary ?? "").length).toBeLessThanOrEqual(4000);
  });
});
