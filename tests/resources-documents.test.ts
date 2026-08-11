import { describe, expect, it } from "vitest";

import { resourceSchema } from "@/lib/validations/resources";
import {
  ALLOWED_MIME_TYPES,
  documentLinkSchema,
  documentFileSchema,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  sanitizeFileName,
} from "@/lib/validations/documents";

const COMPANY_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

describe("resourceSchema — protection contre les secrets", () => {
  const base = {
    company_id: COMPANY_ID,
    label: "Administration du site",
    url: "https://exemple.fr/wp-admin",
  };

  it("accepte une ressource normale", () => {
    const result = resourceSchema.parse({
      ...base,
      category: "administration_site",
      login_hint: "contact@exemple.fr",
      password_manager_ref: "Bitwarden — Exemple WP",
    });
    expect(result.login_hint).toBe("contact@exemple.fr");
    expect(result.is_favorite).toBe(false);
  });

  it("refuse un mot de passe dans les notes d'accès", () => {
    const result = resourceSchema.safeParse({
      ...base,
      access_notes: "Le mot de passe est Soleil2026",
    });
    expect(result.success).toBe(false);
  });

  it("refuse une clé API dans la description", () => {
    expect(
      resourceSchema.safeParse({ ...base, description: "API key: sk-abc123" })
        .success
    ).toBe(false);
    expect(
      resourceSchema.safeParse({ ...base, description: "token de connexion" })
        .success
    ).toBe(false);
  });

  it("refuse un code de récupération dans l'identifiant", () => {
    expect(
      resourceSchema.safeParse({
        ...base,
        login_hint: "code de récupération 8842",
      }).success
    ).toBe(false);
  });

  it("exige une URL valide", () => {
    expect(
      resourceSchema.safeParse({ ...base, url: "exemple.fr" }).success
    ).toBe(false);
  });
});

describe("documentLinkSchema", () => {
  it("exige un nom et une URL valide", () => {
    expect(
      documentLinkSchema.safeParse({
        company_id: COMPANY_ID,
        name: "Livrable",
        external_url: "pas-une-url",
      }).success
    ).toBe(false);

    const ok = documentLinkSchema.parse({
      company_id: COMPANY_ID,
      name: "Livrable",
      external_url: "https://drive.exemple.fr/doc",
    });
    expect(ok.name).toBe("Livrable");
  });
});

describe("documentFileSchema — limites de téléversement", () => {
  it("refuse un type de fichier non autorisé", () => {
    const result = documentFileSchema.safeParse({
      company_id: COMPANY_ID,
      name: "script",
      mime_type: "application/x-msdownload",
      size_bytes: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("refuse un fichier trop volumineux ou vide", () => {
    const base = {
      company_id: COMPANY_ID,
      name: "doc",
      mime_type: "application/pdf",
    };
    expect(
      documentFileSchema.safeParse({ ...base, size_bytes: MAX_UPLOAD_BYTES + 1 })
        .success
    ).toBe(false);
    expect(
      documentFileSchema.safeParse({ ...base, size_bytes: 0 }).success
    ).toBe(false);
  });

  it("accepte les types courants attendus", () => {
    for (const mime of ["application/pdf", "image/png", "text/csv"]) {
      expect((ALLOWED_MIME_TYPES as readonly string[]).includes(mime)).toBe(true);
    }
  });
});

describe("sanitizeFileName", () => {
  it("retire les accents et remplace les caractères non sûrs", () => {
    expect(sanitizeFileName("Rapport août – résumé.pdf")).toBe(
      "Rapport-aout-resume.pdf"
    );
    expect(sanitizeFileName("fiche 100% béton.docx")).toBe(
      "fiche-100-beton.docx"
    );
  });

  it("neutralise une tentative de remontée de dossier", () => {
    const result = sanitizeFileName("../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("..");
  });

  it("ne renvoie jamais une chaîne vide", () => {
    expect(sanitizeFileName("///")).toBe("fichier");
  });
});

describe("formatFileSize", () => {
  it("affiche octets, kilo-octets et méga-octets", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(2048)).toBe("2 Ko");
    expect(formatFileSize(1_572_864)).toBe("1,5 Mo");
  });
});
