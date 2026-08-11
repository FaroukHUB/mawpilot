import { describe, expect, it } from "vitest";

import {
  addUsage,
  buildBudgetState,
  computeCost,
  DEFAULT_RATES,
  EMPTY_USAGE,
  formatUsd,
  type PricingRates,
} from "@/lib/ai/pricing";

const rates: PricingRates = {
  inputPerMillion: 1.25,
  cachedInputPerMillion: 0.125,
  outputPerMillion: 10,
};

describe("computeCost", () => {
  it("ne coûte rien sans consommation", () => {
    expect(computeCost(EMPTY_USAGE, rates)).toBe(0);
  });

  it("calcule le coût d'un million de jetons d'entrée", () => {
    expect(
      computeCost(
        { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 0 },
        rates
      )
    ).toBe(1.25);
  });

  it("calcule le coût d'un million de jetons de sortie", () => {
    expect(
      computeCost(
        { inputTokens: 0, cachedInputTokens: 0, outputTokens: 1_000_000 },
        rates
      )
    ).toBe(10);
  });

  it("applique le tarif réduit aux jetons en cache sans les compter deux fois", () => {
    // 1000 jetons d'entrée dont 800 en cache :
    // 200 au plein tarif + 800 au tarif réduit.
    const cost = computeCost(
      { inputTokens: 1000, cachedInputTokens: 800, outputTokens: 0 },
      rates
    );
    const expected =
      (200 / 1_000_000) * 1.25 + (800 / 1_000_000) * 0.125;
    expect(cost).toBeCloseTo(expected, 9);
  });

  it("reste correct si le cache dépasse l'entrée (donnée aberrante)", () => {
    const cost = computeCost(
      { inputTokens: 100, cachedInputTokens: 500, outputTokens: 0 },
      rates
    );
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it("calcule une demande réaliste au centième de centime", () => {
    // 3 500 jetons d'entrée, 600 de sortie.
    const cost = computeCost(
      { inputTokens: 3500, cachedInputTokens: 0, outputTokens: 600 },
      rates
    );
    expect(cost).toBeCloseTo(0.004375 + 0.006, 6);
  });

  it("utilise les tarifs fournis, pas des valeurs codées en dur", () => {
    const doubled = computeCost(
      { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 0 },
      { ...rates, inputPerMillion: 2.5 }
    );
    expect(doubled).toBe(2.5);
  });

  it("expose des tarifs par défaut cohérents", () => {
    expect(DEFAULT_RATES.cachedInputPerMillion).toBeLessThan(
      DEFAULT_RATES.inputPerMillion
    );
    expect(DEFAULT_RATES.outputPerMillion).toBeGreaterThan(
      DEFAULT_RATES.inputPerMillion
    );
  });
});

describe("addUsage", () => {
  it("cumule les allers-retours d'une même demande", () => {
    const total = addUsage(
      { inputTokens: 100, cachedInputTokens: 10, outputTokens: 20 },
      { inputTokens: 250, cachedInputTokens: 40, outputTokens: 30 }
    );
    expect(total).toEqual({
      inputTokens: 350,
      cachedInputTokens: 50,
      outputTokens: 50,
    });
  });
});

describe("buildBudgetState", () => {
  const base = {
    creditUsd: 5,
    spentSinceCreditUsd: 1,
    spentThisMonthUsd: 0.5,
    alertThresholdUsd: 2,
  };

  it("calcule le restant", () => {
    const state = buildBudgetState(base);
    expect(state.remainingUsd).toBe(4);
    expect(state.isLow).toBe(false);
    expect(state.isExhausted).toBe(false);
  });

  it("déclenche l'alerte au seuil de 2 $", () => {
    const state = buildBudgetState({ ...base, spentSinceCreditUsd: 3 });
    expect(state.remainingUsd).toBe(2);
    expect(state.isLow).toBe(true);
    expect(state.isExhausted).toBe(false);
  });

  it("signale l'épuisement et ne descend jamais sous zéro", () => {
    const state = buildBudgetState({ ...base, spentSinceCreditUsd: 7 });
    expect(state.remainingUsd).toBe(0);
    expect(state.isExhausted).toBe(true);
    expect(state.isLow).toBe(true);
  });

  it("n'alerte pas tant qu'aucun crédit n'est déclaré", () => {
    const state = buildBudgetState({
      creditUsd: 0,
      spentSinceCreditUsd: 12,
      spentThisMonthUsd: 12,
      alertThresholdUsd: 2,
    });
    expect(state.isLow).toBe(false);
    expect(state.isExhausted).toBe(false);
  });

  it("respecte un seuil personnalisé", () => {
    const state = buildBudgetState({
      ...base,
      spentSinceCreditUsd: 0.5,
      alertThresholdUsd: 4.6,
    });
    expect(state.remainingUsd).toBe(4.5);
    expect(state.isLow).toBe(true);
  });
});

describe("formatUsd", () => {
  it("affiche quatre décimales pour les très petits montants", () => {
    expect(formatUsd(0.0042)).toBe("0,0042 $");
  });

  it("affiche deux décimales au-delà d'un centime", () => {
    expect(formatUsd(1.235)).toBe("1,24 $");
    expect(formatUsd(12)).toBe("12,00 $");
  });

  it("affiche zéro simplement", () => {
    expect(formatUsd(0)).toBe("0 $");
  });
});
