"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

const budgetSchema = z.object({
  credit_usd: z.coerce.number().min(0, "Montant invalide.").max(100000),
  alert_threshold_usd: z.coerce.number().min(0).max(10000),
  price_input_per_million: z.coerce.number().min(0).max(10000),
  price_cached_input_per_million: z.coerce.number().min(0).max(10000),
  price_output_per_million: z.coerce.number().min(0).max(10000),
  /** Vrai quand l'utilisateur vient de recharger : on repart de zéro. */
  reset_counter: z.coerce.boolean().default(false),
});

export async function updateBudget(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { reset_counter, ...values } = parsed.data;

  const { error } = await supabase.from("ai_budget").upsert(
    {
      user_id: user.id,
      ...values,
      ...(reset_counter ? { credit_since: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath("/parametres");
  revalidatePath("/assistant");
  return { data: { ok: true } };
}
