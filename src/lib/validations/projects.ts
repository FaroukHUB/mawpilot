import { z } from "zod";

import { PROJECT_STATUSES } from "@/lib/enums";

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.iso.date("Date invalide.").nullable())
  .nullable()
  .optional();

export const projectSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  status: z.enum(PROJECT_STATUSES).default("actif"),
  start_date: optionalDate,
  end_date: optionalDate,
});

export type ProjectInput = z.infer<typeof projectSchema>;
