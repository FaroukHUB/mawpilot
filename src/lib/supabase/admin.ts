import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client d'administration Supabase — SERVEUR UNIQUEMENT.
 *
 * ⚠ Ce client utilise la clé `service_role`, qui contourne la RLS.
 * Il n'existe que pour le planificateur (`/api/cron/tick`), qui doit traiter
 * des rappels sans session utilisateur. Il ne doit JAMAIS être :
 * - importé dans un composant client ;
 * - utilisé dans une action déclenchée par l'utilisateur.
 *
 * Partout ailleurs, on utilise `@/lib/supabase/server`, qui applique la RLS.
 *
 * La clé n'est pas préfixée `NEXT_PUBLIC_` : elle n'atteint jamais le
 * navigateur. Le test `tests/server-boundaries.test.ts` vérifie qu'aucun
 * composant client n'importe ce module.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Planificateur non configuré : SUPABASE_SERVICE_ROLE_KEY est absente."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSchedulerConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET
  );
}
