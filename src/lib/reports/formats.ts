/**
 * Formats d'export des rapports.
 *
 * Ces constantes vivent dans un module neutre : un fichier `"use server"` ne
 * doit exporter que des fonctions asynchrones, sinon le navigateur reçoit une
 * référence d'appel distant à la place de la valeur (voir src/lib/memories.ts
 * pour le bug d'origine, et tests/server-boundaries.test.ts pour le garde-fou).
 */

export const REPORT_FORMATS = ["whatsapp", "pdf", "docx", "xlsx"] as const;

export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const reportFormatLabels: Record<ReportFormat, string> = {
  whatsapp: "Message WhatsApp",
  pdf: "PDF imprimable",
  docx: "Document Word",
  xlsx: "Tableur Excel",
};
