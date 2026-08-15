"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { REPORT_FORMATS } from "@/lib/reports/formats";
import { REPORT_SECTION_KEYS } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

/**
 * Configuration des rapports par entreprise.
 *
 * `report_schedules` porte le QUOI (sections, format, destination) ;
 * `automation_rules` porte le QUAND. Enregistrer une configuration
 * synchronise la règle d'automatisation correspondante, de sorte qu'il
 * n'existe qu'un seul chemin de planification (voir migration 12).
 */

const scheduleSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  frequency: z.enum(["hebdomadaire", "mensuel"]),
  day_of_week: z.coerce.number().int().min(1).max(7).nullable().optional(),
  day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
  time_of_day: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Heure invalide (format HH:MM)."),
  default_channel_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Destination invalide.").nullable())
    .nullable()
    .optional(),
  default_format: z.enum(REPORT_FORMATS).default("whatsapp"),
  sections: z.array(z.enum(REPORT_SECTION_KEYS)).default([]),
  is_active: z.coerce.boolean().default(true),
});

export async function saveReportSchedule(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  if (parsed.data.frequency === "hebdomadaire" && !parsed.data.day_of_week) {
    return { error: "Choisissez le jour de la semaine." };
  }
  if (parsed.data.frequency === "mensuel" && !parsed.data.day_of_month) {
    return { error: "Choisissez le jour du mois." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", parsed.data.company_id)
    .eq("user_id", user.id)
    .single();
  if (!company) return { error: "Entreprise introuvable." };

  const { error } = await supabase.from("report_schedules").upsert(
    {
      user_id: user.id,
      company_id: company.id,
      frequency: parsed.data.frequency,
      day_of_week:
        parsed.data.frequency === "hebdomadaire"
          ? (parsed.data.day_of_week ?? null)
          : null,
      day_of_month:
        parsed.data.frequency === "mensuel"
          ? (parsed.data.day_of_month ?? null)
          : null,
      time_of_day: parsed.data.time_of_day,
      timezone: "Europe/Paris",
      default_channel_id: parsed.data.default_channel_id ?? null,
      default_format: parsed.data.default_format,
      sections: parsed.data.sections,
      is_active: parsed.data.is_active,
    },
    { onConflict: "company_id" }
  );

  if (error) return { error: "Enregistrement impossible : " + error.message };

  // Synchronise la règle qui déclenche réellement la préparation.
  await syncAutomationRule(supabase, user.id, company.id, parsed.data);

  revalidatePath(`/entreprises/${company.id}`);
  revalidatePath("/rappels");
  return { data: { ok: true } };
}

async function syncAutomationRule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companyId: string,
  data: z.infer<typeof scheduleSchema>
): Promise<void> {
  const { data: existing } = await supabase
    .from("automation_rules")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("kind", "rapport_hebdo")
    .maybeSingle();

  const payload = {
    user_id: userId,
    company_id: companyId,
    kind: "rapport_hebdo" as const,
    frequency: data.frequency,
    time_of_day: data.time_of_day,
    timezone: "Europe/Paris",
    day_of_week:
      data.frequency === "hebdomadaire" ? (data.day_of_week ?? null) : null,
    day_of_month:
      data.frequency === "mensuel" ? (data.day_of_month ?? null) : null,
    is_active: data.is_active,
  };

  if (existing) {
    await supabase
      .from("automation_rules")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId);
  } else {
    await supabase.from("automation_rules").insert(payload);
  }
}

export async function disableReportSchedule(
  companyId: string
): Promise<ActionResult<{ ok: true }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  await supabase
    .from("report_schedules")
    .update({ is_active: false })
    .eq("company_id", companyId)
    .eq("user_id", user.id);

  await supabase
    .from("automation_rules")
    .update({ is_active: false })
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .eq("kind", "rapport_hebdo");

  revalidatePath(`/entreprises/${companyId}`);
  revalidatePath("/rappels");
  return { data: { ok: true } };
}
