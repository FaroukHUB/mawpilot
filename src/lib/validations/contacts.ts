import { z } from "zod";

import { isValidInternationalNumber, normalizePhoneNumber } from "@/lib/whatsapp";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const contactSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  name: z.string().trim().min(1, "Le nom est requis.").max(200),
  role: optionalText(200),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.email("Email invalide.").nullable())
    .nullable()
    .optional(),
  phone: optionalText(50),
  whatsapp_number: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : normalizePhoneNumber(v)))
    .nullable()
    .optional()
    .refine(
      (v) => v === null || v === undefined || isValidInternationalNumber(v),
      "Numéro WhatsApp invalide : utilisez le format international, ex. +33612345678."
    ),
  preferred_channel: optionalText(100),
  notes: optionalText(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const CHANNEL_TYPES = [
  "whatsapp_direct",
  "whatsapp_groupe",
  "email",
  "autre",
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const channelTypeLabels: Record<ChannelType, string> = {
  whatsapp_direct: "WhatsApp direct",
  whatsapp_groupe: "Groupe WhatsApp",
  email: "Email",
  autre: "Autre",
};

export const channelSchema = z
  .object({
    company_id: z.uuid("Entreprise invalide."),
    type: z.enum(CHANNEL_TYPES),
    label: z.string().trim().min(1, "Le libellé est requis.").max(200),
    contact_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Contact invalide.").nullable())
      .nullable()
      .optional(),
    phone_number: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : normalizePhoneNumber(v)))
      .nullable()
      .optional(),
    group_name: optionalText(200),
    open_url: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.url("URL invalide.").nullable())
      .nullable()
      .optional(),
    instructions: optionalText(1000),
    is_default: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.type === "whatsapp_direct") {
      if (!data.phone_number) {
        ctx.addIssue({
          code: "custom",
          path: ["phone_number"],
          message: "Un WhatsApp direct exige un numéro international.",
        });
      } else if (!isValidInternationalNumber(data.phone_number)) {
        ctx.addIssue({
          code: "custom",
          path: ["phone_number"],
          message:
            "Numéro invalide : format international attendu, ex. +33612345678.",
        });
      }
    }
    if (data.type === "whatsapp_groupe" && !data.group_name) {
      ctx.addIssue({
        code: "custom",
        path: ["group_name"],
        message: "Indiquez le nom du groupe (aide-mémoire pour le partage).",
      });
    }
  });

export type ChannelInput = z.infer<typeof channelSchema>;
