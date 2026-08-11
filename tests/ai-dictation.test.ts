import { describe, expect, it, vi } from "vitest";

import { buildSystemPrompt } from "@/lib/ai/context";
import { validateFunctionArguments } from "@/lib/ai/functions";
import { runInterpretation, type ModelTurn } from "@/lib/ai/interpret";

/**
 * Scénarios de dictée exigés : une seule phrase doit pouvoir produire
 * plusieurs actions, sans jamais réclamer un renseignement facultatif.
 *
 * Le modèle est simulé : ces tests vérifient le comportement de NOTRE moteur
 * (extraction multiple, validation, absence d'exécution avant confirmation),
 * pas la qualité de la réponse d'OpenAI.
 */

const TRUST = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const TASK = "1c8f6d0e-2a4b-4c9d-8e7f-0a1b2c3d4e5f";

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
    usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50 },
  };
}

const noReads = vi.fn(async () => []);

describe("scénario 1 — temps + tâches en une phrase", () => {
  it("propose l'enregistrement du temps ET les tâches terminées", async () => {
    const callModel = vi.fn(async () =>
      turn("Voici ce que j'ai compris.", [
        {
          name: "log_time",
          args: {
            company_id: TRUST,
            minutes: 90,
            description: "Corrections produits et article de blog",
          },
        },
        { name: "complete_task", args: { task_id: TASK } },
        {
          name: "create_task",
          args: {
            company_id: TRUST,
            title: "Article de blog",
            status: "terminee",
          },
        },
      ])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage:
        "Aujourd'hui j'ai travaillé une heure trente sur Trust, j'ai corrigé trois produits et terminé l'article de blog.",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toHaveLength(3);
    expect(result.proposedActions.map((a) => a.name)).toEqual([
      "log_time",
      "complete_task",
      "create_task",
    ]);
    // 1 h 30 correctement converti en minutes.
    expect(result.proposedActions[0].arguments.minutes).toBe(90);
    expect(result.issues).toEqual([]);
  });

  it("cherche les tâches existantes avant de proposer", async () => {
    const executeRead = vi.fn(async () => [
      { id: TASK, titre: "Fiches produits", statut: "en_cours" },
    ]);
    const callModel = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValueOnce(
        turn("", [
          { name: "search_tasks", args: { company_id: TRUST, query: "produit" } },
        ])
      )
      .mockResolvedValueOnce(
        turn("Je termine la tâche existante.", [
          { name: "complete_task", args: { task_id: TASK } },
        ])
      );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "J'ai corrigé les fiches produits",
      callModel,
      executeRead,
    });

    expect(executeRead).toHaveBeenCalledOnce();
    // Une tâche existante est terminée, pas dupliquée.
    expect(result.proposedActions.map((a) => a.name)).toEqual(["complete_task"]);
  });
});

describe("scénario 4 — création d'entreprise sans champs facultatifs", () => {
  it("accepte une entreprise avec le seul nom", () => {
    const result = validateFunctionArguments("create_company", {
      name: "Collection Originale",
    });
    expect(result.ok).toBe(true);
  });

  it("accepte nom + contact + site, sans email ni forfait ni couleur", () => {
    const result = validateFunctionArguments("create_company", {
      name: "Collection Originale",
      contact_name: "Olivier",
      website: "https://collection-originale.fr",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contact_email).toBeUndefined();
      expect(result.data.monthly_amount).toBeUndefined();
      expect(result.data.color).toBeUndefined();
    }
  });

  it("propose la création immédiatement, sans question intermédiaire", async () => {
    const callModel = vi.fn(async () =>
      turn("Je crée cette entreprise.", [
        {
          name: "create_company",
          args: {
            name: "Collection Originale",
            contact_name: "Olivier",
            website: "https://collection-originale.fr",
          },
        },
      ])
    );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage:
        "Crée Collection Originale, contact Olivier, ajoute son site.",
      callModel,
      executeRead: noReads,
    });

    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0].description).toContain(
      "Collection Originale"
    );
  });
});

describe("scénario 5 — consultation pure, aucune écriture proposée", () => {
  it("répond sans proposer d'action", async () => {
    const executeRead = vi.fn(async () => [
      { id: TASK, titre: "Fiche Bureau Alcôve", priorite: "urgente" },
    ]);
    const callModel = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValueOnce(
        turn("", [{ name: "get_overdue_tasks", args: {} }])
      )
      .mockResolvedValueOnce(
        turn("Commencez par la fiche Bureau Alcôve, elle est urgente.")
      );

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage:
        "J'ai deux heures devant moi, dis-moi ce que je dois faire en priorité.",
      callModel,
      executeRead,
    });

    expect(result.proposedActions).toEqual([]);
    expect(result.message).toContain("Bureau Alcôve");
  });
});

describe("consigne système — extraction multiple et champs facultatifs", () => {
  const prompt = buildSystemPrompt({
    userName: "Farouk",
    companies: [{ id: TRUST, name: "Trust Industrie" }],
    companyScope: null,
    summary: null,
    memories: [],
  });

  it("demande d'extraire toutes les actions d'une dictée", () => {
    expect(prompt).toContain("TOUTES les actions utiles");
    expect(prompt).toContain("en un seul tour");
  });

  it("interdit de réclamer un renseignement facultatif", () => {
    expect(prompt).toContain("NE DEMANDE JAMAIS un renseignement facultatif");
    expect(prompt).toContain("est facultatif");
  });

  it("énumère ce qui est réellement obligatoire", () => {
    expect(prompt).toContain("une tâche : l'entreprise et le titre");
    expect(prompt).toContain("une entreprise : son nom");
  });

  it("conserve la règle d'ambiguïté", () => {
    expect(prompt).toContain("DEMANDE une précision");
  });
});

describe("garanties de sécurité du parcours vocal", () => {
  it("aucune écriture n'est exécutée pendant l'interprétation", async () => {
    const executeRead = vi.fn(async () => []);
    const callModel = vi.fn(async () =>
      turn("", [
        { name: "create_task", args: { company_id: TRUST, title: "X" } },
      ])
    );

    await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "…",
      callModel,
      executeRead,
    });

    // L'exécuteur de lecture ne doit jamais recevoir une fonction d'écriture.
    for (const call of executeRead.mock.calls) {
      expect(call).toBeUndefined();
    }
    expect(executeRead).not.toHaveBeenCalled();
  });

  it("comptabilise le coût de tous les allers-retours", async () => {
    const callModel = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValueOnce(turn("", [{ name: "search_tasks", args: {} }]))
      .mockResolvedValueOnce(turn("Réponse finale."));

    const result = await runInterpretation({
      systemPrompt: "",
      history: [],
      userMessage: "…",
      callModel,
      executeRead: noReads,
    });

    // Deux tours × (100 entrée + 50 sortie).
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.outputTokens).toBe(100);
  });
});
