import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { runDueAutomations } from "@/lib/automations/worker";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Planificateur : traite les rappels et automatisations arrivés à échéance.
 *
 * Appelé toutes les 5 minutes par `pg_cron` depuis Supabase — donc même
 * lorsque l'application est fermée, et sans dépendre de Vercel.
 * Le secret d'appel est stocké dans Supabase Vault (voir migration 9).
 *
 * L'exécution est idempotente : un double appel ne produit jamais deux fois
 * la même notification (contrainte d'unicité sur `automation_runs`).
 */

// Runtime Node : le worker utilise `web-push` et le client d'administration.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comparaison à temps constant : ne fuit pas le secret par la durée. */
function isValidSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractSecret(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return request.headers.get("x-cron-secret");
}

async function handle(request: NextRequest) {
  if (!isValidSecret(extractSecret(request))) {
    // Réponse volontairement muette : on ne renseigne pas un appelant hostile.
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await runDueAutomations(supabase);

    return NextResponse.json({
      ok: true,
      ...summary,
      at: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur du planificateur.";
    console.error("Planificateur :", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** GET accepté pour permettre un test manuel depuis un navigateur ou curl. */
export async function GET(request: NextRequest) {
  return handle(request);
}
