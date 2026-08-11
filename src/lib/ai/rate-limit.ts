import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Protection simple contre les appels IA répétés abusivement.
 * Comptage en base (fiable même avec plusieurs instances serveur) sur une
 * fenêtre glissante. Application mono-utilisateur : ces limites sont
 * volontairement généreuses, elles servent de garde-fou contre une boucle.
 */

export const RATE_LIMITS = {
  perMinute: 12,
  perHour: 120,
};

export async function checkAiRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const nowMs = Date.now();
  const oneMinuteAgo = new Date(nowMs - 60_000).toISOString();
  const oneHourAgo = new Date(nowMs - 3_600_000).toISOString();

  const [{ count: lastMinute }, { count: lastHour }] = await Promise.all([
    supabase
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo),
    supabase
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo),
  ]);

  if ((lastMinute ?? 0) >= RATE_LIMITS.perMinute) {
    return {
      allowed: false,
      message:
        "Trop de demandes en peu de temps. Patientez une minute avant de réessayer.",
    };
  }
  if ((lastHour ?? 0) >= RATE_LIMITS.perHour) {
    return {
      allowed: false,
      message:
        "Limite horaire de l'assistant atteinte. Réessayez dans un moment.",
    };
  }
  return { allowed: true };
}
