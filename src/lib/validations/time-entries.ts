import { z } from "zod";

export const timeEntrySchema = z.object({
  company_id: z.uuid("L'entreprise est requise."),
  task_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Tâche invalide.").nullable())
    .nullable()
    .optional(),
  minutes: z.coerce
    .number({ error: "La durée est requise." })
    .int("Durée invalide.")
    .min(1, "La durée doit être d'au moins 1 minute.")
    .max(24 * 60, "Durée trop longue pour une seule saisie."),
  entry_date: z.iso.date("Date invalide."),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  is_billable: z.coerce.boolean().default(false),
});

export type TimeEntryInput = z.infer<typeof timeEntrySchema>;
