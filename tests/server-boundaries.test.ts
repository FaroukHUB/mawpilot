import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fg from "fast-glob";

/**
 * Garde-fou contre la classe de bugs qui a cassé l'onglet « Mémoire IA ».
 *
 * Un module marqué `"use server"` n'est jamais envoyé au navigateur : Next.js
 * remplace chacun de ses exports par une référence d'appel distant — une
 * FONCTION. Si un tel module exporte un tableau ou un objet et qu'un composant
 * client l'importe, le navigateur reçoit une fonction. D'où le fameux
 * « u.map is not a function » en production, invisible au build.
 *
 * Ces tests échouent AVANT le déploiement si la règle est enfreinte quelque
 * part dans le projet.
 */

const ROOT = join(import.meta.dirname, "..");

function sourceFiles(pattern: string): string[] {
  return fg.sync(pattern, { cwd: ROOT, absolute: true });
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function isServerModule(content: string): boolean {
  return /^\s*["']use server["'];?/m.test(content.split("\n").slice(0, 3).join("\n"));
}

function isClientModule(content: string): boolean {
  return /^\s*["']use client["'];?/m.test(content.split("\n").slice(0, 3).join("\n"));
}

/** Exports de valeurs (donc interdits dans un module serveur). */
function valueExports(content: string): string[] {
  const names: string[] = [];
  // `export const X`, `export let X`, `export enum X`, `export class X`
  for (const match of content.matchAll(
    /^export\s+(?:const|let|var|enum|class)\s+([A-Za-z0-9_$]+)/gm
  )) {
    names.push(match[1]);
  }
  // `export default` d'autre chose qu'une fonction
  if (/^export\s+default\s+(?!async\s+function|function)/m.test(content)) {
    names.push("default");
  }
  return names;
}

describe("frontière serveur / client", () => {
  const serverModules = sourceFiles("src/**/*.{ts,tsx}").filter((file) =>
    isServerModule(read(file))
  );

  it("trouve bien les modules serveur du projet", () => {
    expect(serverModules.length).toBeGreaterThan(0);
  });

  it("aucun module \"use server\" n'exporte de valeur non-fonction", () => {
    const offenders = serverModules
      .map((file) => ({ file, names: valueExports(read(file)) }))
      .filter((entry) => entry.names.length > 0)
      .map(
        (entry) =>
          `${entry.file.replace(ROOT + "/", "")} → ${entry.names.join(", ")}`
      );

    expect(
      offenders,
      "Un fichier \"use server\" ne doit exporter que des fonctions async. " +
        "Déplacez les constantes et types dans un module neutre (src/lib/…) : " +
        "sinon le navigateur reçoit une fonction à la place de la valeur.\n" +
        offenders.join("\n")
    ).toEqual([]);
  });

  it("aucun composant client n'importe une constante depuis @/actions", () => {
    const clientModules = sourceFiles("src/**/*.tsx").filter((file) =>
      isClientModule(read(file))
    );

    // Noms exportés par chaque module d'actions, avec leur nature.
    const actionValueNames = new Set<string>();
    for (const file of sourceFiles("src/actions/*.ts")) {
      const content = read(file);
      if (!isServerModule(content)) continue;
      for (const name of valueExports(content)) actionValueNames.add(name);
    }

    const offenders: string[] = [];
    for (const file of clientModules) {
      const content = read(file);
      for (const match of content.matchAll(
        /import\s*\{([^}]*)\}\s*from\s*["']@\/actions\/[a-z-]+["']/g
      )) {
        const imported = match[1]
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          // `type X` est effacé à la compilation : sans risque.
          .filter((part) => !part.startsWith("type "))
          .map((part) => part.split(/\s+as\s+/)[0].trim());

        for (const name of imported) {
          if (actionValueNames.has(name)) {
            offenders.push(`${file.replace(ROOT + "/", "")} → ${name}`);
          }
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

describe("constantes de la mémoire", () => {
  it("MEMORY_CATEGORIES est bien un tableau utilisable côté client", async () => {
    const { MEMORY_CATEGORIES } = await import("@/lib/memories");

    expect(Array.isArray(MEMORY_CATEGORIES)).toBe(true);
    expect(MEMORY_CATEGORIES.length).toBeGreaterThan(0);
    // C'est exactement l'appel qui plantait en production.
    expect(() => MEMORY_CATEGORIES.map((c) => c)).not.toThrow();
  });

  it("chaque catégorie a un libellé français", async () => {
    const { MEMORY_CATEGORIES, memoryCategoryLabel } = await import(
      "@/lib/memories"
    );
    for (const category of MEMORY_CATEGORIES) {
      const label = memoryCategoryLabel(category);
      expect(label).toBeTruthy();
      expect(label).not.toBe(category);
    }
  });

  it("ne casse pas sur une valeur inconnue venue de la base", async () => {
    const { memoryCategoryLabel, memorySourceLabel } = await import(
      "@/lib/memories"
    );
    expect(memoryCategoryLabel("valeur_inattendue")).toBe("valeur_inattendue");
    expect(memorySourceLabel("valeur_inattendue")).toBe("valeur_inattendue");
  });

  it("le module de la mémoire n'est pas un module serveur", async () => {
    const content = read(join(ROOT, "src/lib/memories.ts"));
    expect(isServerModule(content)).toBe(false);
  });
});
