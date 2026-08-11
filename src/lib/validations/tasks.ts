import { z } from "zod";

import {
  BILLING_STATUSES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/enums";

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid("Identifiant invalide.").nullable())
  .nullable()
  .optional();

export const taskSchema = z.object({
  company_id: z.uuid("L'entreprise est requise."),
  project_id: optionalUuid,
  title: z.string().trim().min(1, "Le titre est requis.").max(300),
  description: z
    .string()
    .trim()
    .max(10000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  category: z.enum(TASK_CATEGORIES).default("autre"),
  status: z.enum(TASK_STATUSES).default("a_faire"),
  priority: z.enum(TASK_PRIORITIES).default("normale"),
  due_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.iso.date("Date d'échéance invalide.").nullable())
    .nullable()
    .optional(),
  estimated_minutes: z
    .union([z.literal(""), z.null(), z.coerce.number().int().min(0, "Estimation invalide.")])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  billing_status: z.enum(BILLING_STATUSES).default("incluse"),
  amount: z
    .union([z.literal(""), z.null(), z.coerce.number().min(0, "Montant invalide.")])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export type TaskInput = z.infer<typeof taskSchema>;
