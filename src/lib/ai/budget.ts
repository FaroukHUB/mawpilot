import type { SupabaseClient } from "@supabase/supabase-js";

import { monthStartISODate } from "@/lib/dates";
import {
  buildBudgetState,
  DEFAULT_RATES,
  type BudgetState,
  type PricingRates,
} from "@/lib/ai/pricing";

export type BudgetSettings = {
  creditUsd: number;
  creditSince: string;
  alertThresholdUsd: number;
  rates: PricingRates;
};

const DEFAULT_SETTINGS: BudgetSettings = {
  creditUsd: 0,
  creditSince: new Date(0).toISOString(),
  alertThresholdUsd: 2,
  rates: DEFAULT_RATES,
};

/** Réglages de budget de l'utilisateur (valeurs par défaut si absent). */
export async function loadBudgetSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgetSettings> {
  const { data } = await supabase
    .from("ai_budget")
    .select()
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;

  return {
    creditUsd: Number(data.credit_usd ?? 0),
    creditSince: data.credit_since ?? DEFAULT_SETTINGS.creditSince,
    alertThresholdUsd: Number(data.alert_threshold_usd ?? 2),
    rates: {
      inputPerMillion: Number(
        data.price_input_per_million ?? DEFAULT_RATES.inputPerMillion
      ),
      cachedInputPerMillion: Number(
        data.price_cached_input_per_million ??
          DEFAULT_RATES.cachedInputPerMillion
      ),
      outputPerMillion: Number(
        data.price_output_per_million ?? DEFAULT_RATES.outputPerMillion
      ),
    },
  };
}

function sumCost(rows: { cost_usd: number | string }[] | null): number {
  return Math.round(
    (rows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0) * 1_000_000
  ) / 1_000_000;
}

/** État complet du budget : dépensé ce mois, depuis le crédit, restant. */
export async function loadBudgetState(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgetState & { settings: BudgetSettings }> {
  const settings = await loadBudgetSettings(supabase, userId);
  const monthStart = `${monthStartISODate()}T00:00:00Z`;

  const [{ data: sinceCredit }, { data: thisMonth }] = await Promise.all([
    supabase
      .from("ai_requests")
      .select("cost_usd")
      .eq("user_id", userId)
      .gte("created_at", settings.creditSince),
    supabase
      .from("ai_requests")
      .select("cost_usd")
      .eq("user_id", userId)
      .gte("created_at", monthStart),
  ]);

  return {
    ...buildBudgetState({
      creditUsd: settings.creditUsd,
      spentSinceCreditUsd: sumCost(sinceCredit),
      spentThisMonthUsd: sumCost(thisMonth),
      alertThresholdUsd: settings.alertThresholdUsd,
    }),
    settings,
  };
}
