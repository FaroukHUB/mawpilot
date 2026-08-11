/**
 * Calcul du coût des appels à l'assistant.
 *
 * Les tarifs OpenAI évoluent : ils ne sont donc PAS codés en dur comme une
 * vérité. Ils sont stockés dans `ai_budget` et modifiables dans les réglages —
 * l'utilisateur les recopie depuis la page Tarifs d'OpenAI. Les valeurs par
 * défaut ne servent qu'à démarrer.
 */

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type PricingRates = {
  /** Dollars par million de jetons d'entrée. */
  inputPerMillion: number;
  /** Dollars par million de jetons d'entrée mis en cache (moins chers). */
  cachedInputPerMillion: number;
  /** Dollars par million de jetons de sortie. */
  outputPerMillion: number;
};

export const DEFAULT_RATES: PricingRates = {
  inputPerMillion: 1.25,
  cachedInputPerMillion: 0.125,
  outputPerMillion: 10,
};

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
};

/** Additionne les consommations de plusieurs allers-retours modèle. */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/**
 * Coût en dollars. Les jetons mis en cache sont facturés au tarif réduit et
 * ne sont donc comptés qu'une fois (ils sont inclus dans `inputTokens` par
 * l'API : on les en retire avant d'appliquer le tarif plein).
 */
export function computeCost(usage: TokenUsage, rates: PricingRates): number {
  const fullPriceInput = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens
  );
  const cost =
    (fullPriceInput / 1_000_000) * rates.inputPerMillion +
    (usage.cachedInputTokens / 1_000_000) * rates.cachedInputPerMillion +
    (usage.outputTokens / 1_000_000) * rates.outputPerMillion;

  // Six décimales : une demande coûte souvent moins d'un centime.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Affichage : « 0,0042 $ » ou « 1,23 $ » selon l'ordre de grandeur. */
export function formatUsd(amount: number): string {
  if (amount === 0) return "0 $";
  if (Math.abs(amount) < 0.01) {
    return `${amount.toFixed(4).replace(".", ",")} $`;
  }
  return `${amount.toFixed(2).replace(".", ",")} $`;
}

export type BudgetState = {
  creditUsd: number;
  spentSinceCreditUsd: number;
  spentThisMonthUsd: number;
  remainingUsd: number;
  alertThresholdUsd: number;
  /** Vrai quand il reste moins que le seuil d'alerte. */
  isLow: boolean;
  /** Vrai quand le crédit déclaré est épuisé. */
  isExhausted: boolean;
};

export function buildBudgetState(input: {
  creditUsd: number;
  spentSinceCreditUsd: number;
  spentThisMonthUsd: number;
  alertThresholdUsd: number;
}): BudgetState {
  const remaining = Math.max(
    0,
    Math.round((input.creditUsd - input.spentSinceCreditUsd) * 1_000_000) /
      1_000_000
  );
  return {
    creditUsd: input.creditUsd,
    spentSinceCreditUsd: input.spentSinceCreditUsd,
    spentThisMonthUsd: input.spentThisMonthUsd,
    remainingUsd: remaining,
    alertThresholdUsd: input.alertThresholdUsd,
    // Pas d'alerte tant qu'aucun crédit n'a été déclaré : on ne connaît rien.
    isLow: input.creditUsd > 0 && remaining <= input.alertThresholdUsd,
    isExhausted: input.creditUsd > 0 && remaining <= 0,
  };
}
