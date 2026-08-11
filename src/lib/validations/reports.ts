import { z } from "zod";

import { REPORT_SECTION_KEYS } from "@/lib/reports/types";

export const REPORT_TYPES = ["hebdomadaire", "mensuel", "personnalise"] as const;
export const REPORT_STATUSES = ["brouillon", "pret", "partage", "archive"] as const;

export const reportTypeLabels: Record<(typeof REPORT_TYPES)[number], string> = {
  hebdomadaire: "Hebdomadaire",
  mensuel: "Mensuel",
  personnalise: "Personnalisé",
};

export const reportStatusLabels: Record<
  (typeof REPORT_STATUSES)[number],
  string
> = {
  brouillon: "Brouillon",
  pret: "Prêt",
  partage: "Partagé",
  archive: "Archivé",
};

export const generateReportSchema = z
  .object({
    company_id: z.uuid("Entreprise invalide."),
    type: z.enum(REPORT_TYPES),
    period_start: z.iso.date("Date de début invalide."),
    period_end: z.iso.date("Date de fin invalide."),
  })
  .refine((d) => d.period_end >= d.period_start, {
    path: ["period_end"],
    message: "La date de fin doit suivre la date de début.",
  });

export const reportContentSchema = z.object({
  sections: z.array(
    z.object({
      key: z.enum(REPORT_SECTION_KEYS),
      included: z.boolean(),
      text: z.string().max(10000),
    })
  ),
  metrics: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        value: z.string().trim().min(1).max(200),
      })
    )
    .max(30),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        url: z.url("URL invalide."),
      })
    )
    .max(50),
});

export const updateReportSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(300),
  content: reportContentSchema,
  whatsapp_text: z.string().max(20000),
  status: z.enum(REPORT_STATUSES),
});

export const DELIVERY_METHODS = [
  "whatsapp_direct",
  "partage_natif",
  "copier_coller",
  "telechargement",
  "email",
] as const;

export const deliveryMethodLabels: Record<
  (typeof DELIVERY_METHODS)[number],
  string
> = {
  whatsapp_direct: "WhatsApp direct",
  partage_natif: "Partage natif",
  copier_coller: "Copier-coller",
  telechargement: "Téléchargement",
  email: "Email",
};

export const prepareDeliverySchema = z.object({
  report_id: z.uuid(),
  company_channel_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Destination invalide.").nullable())
    .nullable()
    .optional(),
  destination_label: z.string().trim().min(1).max(200),
  method: z.enum(DELIVERY_METHODS),
  prepared_content: z.string().max(20000),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type PrepareDeliveryInput = z.infer<typeof prepareDeliverySchema>;
