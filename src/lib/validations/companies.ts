import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .max(500, "Texte trop long.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const companySchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).")
    .default("#FFA000"),
  contact_name: optionalTrimmed,
  contact_email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Email invalide.").nullable())
    .nullable()
    .optional(),
  contact_phone: optionalTrimmed,
  website: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.url("URL invalide (inclure https://).").nullable())
    .nullable()
    .optional(),
  notes: z.string().trim().max(5000).transform((v) => (v === "" ? null : v)).nullable().optional(),
  monthly_amount: z
    .union([z.literal(""), z.null(), z.coerce.number().min(0, "Montant invalide.")])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  included_services: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type CompanyInput = z.infer<typeof companySchema>;
