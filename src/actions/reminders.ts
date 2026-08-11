"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { computeNextRun } from "@/lib/automations/schedule";
import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

const FREQUENCIES = ["ponctuel", "quotidien", "hebdomadaire", "mensuel"] as const;

const reminderSchema = z
  .object({
    title: z.string().trim().min(1, "Le titre est requis.").max(300),
    body: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    company_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.uuid("Entreprise invalide.").nullable())
      .nullable()
      .optional(),
    frequency: z.enum(FREQUENCIES).default("ponctuel"),
    /** Requis pour un rappel ponctuel : instant exact (ISO). */
    run_at: z.string().trim().optional(),
    time_of_day: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Heure invalide (format HH:MM).")
      .default("09:00"),
    day_of_week: z.coerce.number().int().min(1).max(7).nullable().optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
    timezone: z.string().default("Europe/Paris"),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "ponctuel" && !data.run_at) {
      ctx.addIssue({
        code: "custom",
        path: ["run_at"],
        message: "Indiquez la date et l'heure du rappel.",
      });
    }
    if (data.frequency === "hebdomadaire" && !data.day_of_week) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_week"],
        message: "Indiquez le jour de la semaine.",
      });
    }
    if (data.frequency === "mensuel" && !data.day_of_month) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_month"],
        message: "Indiquez le jour du mois.",
      });
    }
  });

export async function createReminder(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  if (parsed.data.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", parsed.data.company_id)
      .eq("user_id", user.id)
      .single();
    if (!company) return { error: "Entreprise introuvable." };
  }

  // Première échéance : instant fourni pour un ponctuel, calculé sinon.
  let nextRunAt: Date | null;
  if (parsed.data.frequency === "ponctuel") {
    const parsedDate = new Date(parsed.data.run_at!);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Date de rappel invalide." };
    }
    if (parsedDate.getTime() <= Date.now()) {
      return { error: "Ce rappel est déjà passé : choisissez une date future." };
    }
    nextRunAt = parsedDate;
  } else {
    nextRunAt = computeNextRun({
      frequency: parsed.data.frequency,
      timeOfDay: parsed.data.time_of_day,
      timezone: parsed.data.timezone,
      dayOfWeek: parsed.data.day_of_week ?? null,
      dayOfMonth: parsed.data.day_of_month ?? null,
    });
  }

  if (!nextRunAt) return { error: "Impossible de calculer l'échéance." };

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      company_id: parsed.data.company_id ?? null,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      frequency: parsed.data.frequency,
      next_run_at: nextRunAt.toISOString(),
      time_of_day: parsed.data.time_of_day,
      timezone: parsed.data.timezone,
      day_of_week: parsed.data.day_of_week ?? null,
      day_of_month: parsed.data.day_of_month ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: "Création impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "rappel_cree",
    description: `Rappel « ${parsed.data.title} » programmé.`,
    companyId: parsed.data.company_id ?? null,
  });

  revalidatePath("/rappels");
  revalidatePath("/dashboard");
  return { data: { id: data.id } };
}

export async function cancelReminder(
  reminderId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("reminders")
    .update({ status: "annule" })
    .eq("id", reminderId)
    .eq("user_id", user.id)
    .select("id, title")
    .single();

  if (error || !data) return { error: "Rappel introuvable." };

  revalidatePath("/rappels");
  return { data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Règles d'automatisation
// ---------------------------------------------------------------------------

const KINDS = [
  "briefing_matin",
  "compte_rendu_soir",
  "rapport_hebdo",
  "relance_sans_reponse",
  "saisie_temps_manquante",
] as const;

const ruleSchema = z.object({
  kind: z.enum(KINDS),
  company_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .nullable()
    .optional(),
  frequency: z.enum(FREQUENCIES).default("quotidien"),
  time_of_day: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Heure invalide (format HH:MM).")
    .default("08:00"),
  day_of_week: z.coerce.number().int().min(1).max(7).nullable().optional(),
  day_of_month: z.coerce.number().int().min(1).max(31).nullable().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  is_active: z.coerce.boolean().default(true),
});

export async function saveAutomationRule(
  input: unknown,
  ruleId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  if (parsed.data.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("id", parsed.data.company_id)
      .eq("user_id", user.id)
      .single();
    if (!company) return { error: "Entreprise introuvable." };
  }

  const payload = {
    kind: parsed.data.kind,
    company_id: parsed.data.company_id ?? null,
    frequency: parsed.data.frequency,
    time_of_day: parsed.data.time_of_day,
    day_of_week: parsed.data.day_of_week ?? null,
    day_of_month: parsed.data.day_of_month ?? null,
    params: parsed.data.params,
    is_active: parsed.data.is_active,
  };

  const query = ruleId
    ? supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", ruleId)
        .eq("user_id", user.id)
    : supabase
        .from("automation_rules")
        .insert({ ...payload, user_id: user.id });

  const { data, error } = await query.select("id").single();
  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath("/rappels");
  return { data: { id: data.id } };
}

export async function setRuleActive(
  ruleId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("automation_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) return { error: "Règle introuvable." };

  revalidatePath("/rappels");
  return { data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) return { error: "Notification introuvable." };

  revalidatePath("/rappels");
  revalidatePath("/dashboard");
  return { data: { id: data.id } };
}

export async function markAllNotificationsRead(): Promise<
  ActionResult<{ ok: true }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidatePath("/rappels");
  revalidatePath("/dashboard");
  return { data: { ok: true } };
}
