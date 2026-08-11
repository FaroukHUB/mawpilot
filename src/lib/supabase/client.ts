import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase côté navigateur (clé publique anon, protégée par RLS). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
