import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy Next.js (ex-middleware) : rafraîchit la session Supabase à chaque
 * requête et redirige vers /login si une page protégée est visitée sans
 * session. La vérification fine reste faite dans les layouts/actions serveur.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Important : getUser() valide le jeton auprès de Supabase et déclenche le
  // rafraîchissement de session. Ne pas remplacer par getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    // Portail client : authentifié par jeton, sans session Supabase.
    // La validation du jeton est faite par la page et la route elles-mêmes.
    pathname.startsWith("/client/") ||
    pathname.startsWith("/api/client/") ||
    // L'espace client a sa propre vérification de rôle dans son layout.
    pathname.startsWith("/espace") ||
    // Planificateur : authentifié par secret partagé.
    pathname.startsWith("/api/cron/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("suivant", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et images Next.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
