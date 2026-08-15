import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fg from "fast-glob";

/**
 * Garde-fou contre les écrans orphelins.
 *
 * La page `/demandes` existait, recevait bien les demandes des clients et
 * enregistrait ses notifications — mais aucun lien n'y menait. Résultat :
 * l'utilisateur ne « recevait » rien, alors que tout fonctionnait en base.
 *
 * Ces tests échouent dès qu'un écran principal devient inaccessible.
 */

const ROOT = join(import.meta.dirname, "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Routes de premier niveau du cockpit (hors segments dynamiques). */
function topLevelAppRoutes(): string[] {
  // Les parenthèses du groupe de routes doivent être échappées : sans cela le
  // motif ne correspond à aucun fichier et le test passerait à vide.
  const pages = fg.sync("src/app/\\(app\\)/**/page.tsx", { cwd: ROOT });
  const routes = pages
    .map((page) =>
      page
        .replace("src/app/(app)/", "")
        .replace(/\/page\.tsx$/, "")
        .replace(/page\.tsx$/, "")
    )
    .filter((route) => route !== "")
    // On ne garde que le premier segment, et jamais un segment dynamique.
    .map((route) => route.split("/")[0])
    .filter((segment) => !segment.startsWith("[") && !segment.startsWith("("));

  return [...new Set(routes)];
}

describe("navigation du cockpit", () => {
  const navSource = read("src/components/layout/nav-items.ts");

  it("expose chaque écran principal dans le menu", () => {
    const routes = topLevelAppRoutes();
    // Filet : si le motif ne trouve plus rien, le test doit hurler, pas passer.
    expect(routes.length).toBeGreaterThan(5);

    const missing = routes.filter(
      (route) => !navSource.includes(`href: "/${route}"`)
    );

    expect(
      missing,
      `Écrans sans lien dans la navigation : ${missing.join(", ")}. ` +
        "Une page inaccessible équivaut à une page absente."
    ).toEqual([]);
  });

  it("mène bien vers les demandes clients", () => {
    expect(navSource).toContain('href: "/demandes"');
  });
});

describe("visibilité des notifications", () => {
  it("affiche la cloche sur mobile comme sur ordinateur", () => {
    for (const file of [
      "src/components/layout/sidebar.tsx",
      "src/components/layout/mobile-nav.tsx",
    ]) {
      expect(read(file), `${file} doit afficher NotificationBell`).toContain(
        "<NotificationBell"
      );
    }
  });

  it("alimente la cloche depuis la mise en page du cockpit", () => {
    const layout = read("src/app/(app)/layout.tsx");
    expect(layout).toContain('from("notifications")');
    expect(layout).toContain('from("client_requests")');
  });

  it("prévient le prestataire à chaque message client", () => {
    const action = read("src/actions/client-space.ts");
    expect(action).toContain("notifyUser");
    // L'URL de la notification doit mener à un écran réellement atteignable.
    expect(action).toContain('url: "/demandes"');
  });
});
