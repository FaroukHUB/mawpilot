import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le client n'a aucun droit sur le Storage : l'action serveur est la SEULE
 * barrière entre lui et le bucket privé. Ces tests verrouillent cette
 * barrière, ainsi que la traçabilité de la réponse du prestataire.
 */

const ROOT = join(import.meta.dirname, "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const action = read("src/actions/client-space.ts");

describe("pièces jointes déposées par le client", () => {
  it("refuse tout format non prévu", () => {
    expect(action).toContain("ALLOWED_ATTACHMENT_TYPES");
    expect(action).toContain("ALLOWED_ATTACHMENT_TYPES as readonly string[]");

    // Aucun format exécutable ou scriptable dans la liste.
    for (const forbidden of [
      "text/html",
      "image/svg+xml",
      "application/javascript",
      "application/x-httpd-php",
    ]) {
      expect(action).not.toContain(`"${forbidden}"`);
    }
  });

  it("plafonne la taille des fichiers", () => {
    expect(action).toContain("MAX_ATTACHMENT_BYTES");
    expect(action).toMatch(/MAX_ATTACHMENT_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/);
    expect(action).toContain("file.size > MAX_ATTACHMENT_BYTES");
  });

  it("range le fichier sous le dossier du prestataire", () => {
    // Sans ce préfixe, la politique Storage existante ne couvrirait pas le
    // fichier et le prestataire ne pourrait pas l'ouvrir.
    expect(action).toContain("${link.owner_user_id}/clients/");
  });

  it("ne laisse pas de fichier orphelin si l'enregistrement échoue", () => {
    expect(action).toContain(".remove([storagePath])");
  });

  it("borne le rattachement à l'entreprise du client", () => {
    // Un identifiant deviné ne doit pas pouvoir déplacer la pièce jointe d'un
    // autre dossier vers la demande en cours.
    const links = action.match(/\.from\("client_attachments"\)\s*\n\s*\.update\(/g);
    expect(links, "les rattachements doivent passer par update()").not.toBeNull();
    expect(action).toContain('.eq("company_id", account.companyId)');
    expect(action).toContain('.is("message_id", null)');
    expect(action).toContain('.is("request_id", null)');
  });

  it("limite le nombre d'envois par heure", () => {
    expect(action).toContain("MAX_ATTACHMENTS_PER_HOUR");
  });
});

describe("réponse du prestataire", () => {
  const ownerActions = read("src/actions/client-access.ts");

  it("est enregistrée sur la demande, pas seulement dans la conversation", () => {
    expect(ownerActions).toContain("owner_reply");
    expect(ownerActions).toContain("owner_replied_at");
  });

  it("est écrite aussi bien en répondant qu'en acceptant", () => {
    const occurrences = ownerActions.match(/owner_replied_at/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("rafraîchit l'espace du client", () => {
    expect(ownerActions).toContain('revalidatePath("/espace")');
  });

  it("est affichée au client comme « Réponse obtenue »", () => {
    const view = read("src/components/client-portal/client-space-requests.tsx");
    expect(view).toContain("Réponse obtenue");
    expect(view).toContain("item.ownerReply");
  });
});
