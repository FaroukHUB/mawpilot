import { z } from "zod";

export const DOCUMENT_TYPES = [
  "fichier",
  "lien_externe",
  "document_genere",
  "tableau_genere",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const documentTypeLabels: Record<DocumentType, string> = {
  fichier: "Fichier",
  lien_externe: "Lien externe",
  document_genere: "Document généré",
  tableau_genere: "Tableau généré",
};

/** 25 Mo : au-delà, mieux vaut un lien externe. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/zip",
] as const;

const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid("Identifiant invalide.").nullable())
  .nullable()
  .optional();

/** Métadonnées communes à tous les documents. */
const documentBase = {
  company_id: z.uuid("Entreprise invalide."),
  project_id: optionalUuid,
  task_id: optionalUuid,
  name: z.string().trim().min(1, "Le nom est requis.").max(300),
  description: optionalText(2000),
  category: optionalText(100),
  document_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.iso.date("Date invalide.").nullable())
    .nullable()
    .optional(),
  version: optionalText(50),
};

/** Document de type « lien externe ». */
export const documentLinkSchema = z.object({
  ...documentBase,
  external_url: z.url("URL invalide (inclure https://)."),
});

/** Métadonnées accompagnant un fichier téléversé. */
export const documentFileSchema = z.object({
  ...documentBase,
  mime_type: z
    .string()
    .refine(
      (v) => (ALLOWED_MIME_TYPES as readonly string[]).includes(v),
      "Type de fichier non autorisé."
    ),
  size_bytes: z
    .number()
    .int()
    .positive("Fichier vide.")
    .max(MAX_UPLOAD_BYTES, "Fichier trop volumineux (25 Mo maximum)."),
});

export type DocumentLinkInput = z.infer<typeof documentLinkSchema>;
export type DocumentFileInput = z.infer<typeof documentFileSchema>;

/** Nettoie un nom de fichier pour un chemin de stockage sûr. */
export function sanitizeFileName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/\.{2,}/g, ".") // neutralise toute tentative de remontée de dossier
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return normalized.slice(0, 120) || "fichier";
}

/** Taille lisible : 1,2 Mo. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(0).replace(".", ",")} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
