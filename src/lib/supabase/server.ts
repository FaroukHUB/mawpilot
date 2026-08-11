import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur (Server Components, Server Actions,
 * Route Handlers). La session est lue depuis les cookies de la requête.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appel depuis un Server Component : l'écriture des cookies est
            // gérée par le proxy (rafraîchissement de session).
          }
        },
      },
    }
  );
}

/**
 * Retourne l'utilisateur connecté, vérifié auprès du serveur Supabase
 * (jamais depuis le cookie seul). Null si non connecté.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
