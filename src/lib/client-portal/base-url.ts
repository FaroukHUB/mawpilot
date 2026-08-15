import "server-only";
import { headers } from "next/headers";

/**
 * Domaine réel de l'application, déduit de la requête en cours.
 *
 * Pourquoi ne pas se contenter de NEXT_PUBLIC_APP_URL : cette variable peut
 * rester sur une valeur provisoire après un déploiement, et les liens de
 * portail deviennent alors inutilisables (404 sur un domaine inexistant).
 * On lit donc l'hôte de la requête, avec la variable en simple repli.
 */
export async function getAppBaseUrl(): Promise<string> {
  const headerList = await headers();

  // Vercel et la plupart des hébergeurs renseignent ces en-têtes.
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? null;

  if (host) {
    const protocol =
      headerList.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${protocol}://${host}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}
