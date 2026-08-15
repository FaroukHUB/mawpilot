import type { SupabaseClient } from "@supabase/supabase-js";

import { computeNextRun, isRuleDue, occurrenceKey } from "@/lib/automations/schedule";
import { formatMinutes, todayISODate } from "@/lib/dates";
import { notifyUser } from "@/lib/notifications/dispatch";
import { fetchReportFacts } from "@/lib/reports/collect";
import { formatLongText, formatWhatsAppMessage } from "@/lib/reports/format";
import {
  buildReportTitle,
  lastMonthPeriod,
  lastWeekPeriod,
} from "@/lib/reports/periods";
import { defaultReportContent } from "@/lib/reports/types";

/**
 * Traitement des rappels et automatisations dus.
 *
 * IDEMPOTENCE : chaque exécution insère d'abord une ligne dans
 * `automation_runs` avec une clé d'occurrence unique. Si l'insertion échoue
 * pour cause de doublon, l'occurrence a déjà été traitée et on passe.
 * Le planificateur peut donc se déclencher deux fois sans conséquence.
 */

export type TickSummary = {
  remindersProcessed: number;
  rulesProcessed: number;
  skipped: number;
  errors: string[];
};

/** Réserve l'occurrence. `false` = déjà traitée ailleurs. */
async function claimOccurrence(
  supabase: SupabaseClient,
  userId: string,
  sourceType: "reminder" | "rule",
  sourceId: string,
  key: string
): Promise<boolean> {
  const { error } = await supabase.from("automation_runs").insert({
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    occurrence_key: key,
  });
  // 23505 = violation d'unicité : l'occurrence existe déjà.
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

async function recordResult(
  supabase: SupabaseClient,
  sourceType: "reminder" | "rule",
  sourceId: string,
  key: string,
  status: "succes" | "echec",
  detail: string
): Promise<void> {
  await supabase
    .from("automation_runs")
    .update({ status, detail })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("occurrence_key", key);
}

export async function runDueAutomations(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<TickSummary> {
  const summary: TickSummary = {
    remindersProcessed: 0,
    rulesProcessed: 0,
    skipped: 0,
    errors: [],
  };

  await processReminders(supabase, now, summary);
  await processRules(supabase, now, summary);
  return summary;
}

// ---------------------------------------------------------------------------
// Rappels
// ---------------------------------------------------------------------------

async function processReminders(
  supabase: SupabaseClient,
  now: Date,
  summary: TickSummary
): Promise<void> {
  const { data } = await supabase
    .from("reminders")
    .select("*, companies(name)")
    .eq("status", "actif")
    .lte("next_run_at", now.toISOString())
    .limit(100);

  for (const reminder of data ?? []) {
    const key = occurrenceKey(new Date(reminder.next_run_at), reminder.timezone);
    try {
      const claimed = await claimOccurrence(
        supabase,
        reminder.user_id,
        "reminder",
        reminder.id,
        key
      );
      if (!claimed) {
        summary.skipped++;
        continue;
      }

      const company = (reminder.companies as { name?: string } | null)?.name;
      await notifyUser(supabase, reminder.user_id, {
        title: reminder.title,
        body:
          reminder.body ??
          (company ? `Rappel concernant ${company}.` : "Rappel MAW Pilot."),
        url: reminder.company_id
          ? `/entreprises/${reminder.company_id}`
          : "/dashboard",
      });

      // Replanifie ou clôture.
      const next = computeNextRun(
        {
          frequency: reminder.frequency,
          timeOfDay: reminder.time_of_day,
          timezone: reminder.timezone,
          dayOfWeek: reminder.day_of_week,
          dayOfMonth: reminder.day_of_month,
        },
        now
      );

      await supabase
        .from("reminders")
        .update(
          next
            ? { next_run_at: next.toISOString(), last_run_at: now.toISOString() }
            : { status: "termine", last_run_at: now.toISOString() }
        )
        .eq("id", reminder.id);

      await recordResult(
        supabase,
        "reminder",
        reminder.id,
        key,
        "succes",
        "Notification envoyée."
      );
      summary.remindersProcessed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      summary.errors.push(`Rappel ${reminder.id} : ${message}`);
      await recordResult(supabase, "reminder", reminder.id, key, "echec", message);
    }
  }
}

// ---------------------------------------------------------------------------
// Règles d'automatisation
// ---------------------------------------------------------------------------

async function processRules(
  supabase: SupabaseClient,
  now: Date,
  summary: TickSummary
): Promise<void> {
  const { data } = await supabase
    .from("automation_rules")
    .select("*, companies(id, name)")
    .eq("is_active", true)
    .limit(200);

  for (const rule of data ?? []) {
    const { due, scheduledAt } = isRuleDue(
      {
        frequency: rule.frequency,
        timeOfDay: rule.time_of_day,
        timezone: rule.timezone,
        dayOfWeek: rule.day_of_week,
        dayOfMonth: rule.day_of_month,
      },
      now
    );
    if (!due || !scheduledAt) continue;

    const key = occurrenceKey(scheduledAt, rule.timezone);
    try {
      const claimed = await claimOccurrence(
        supabase,
        rule.user_id,
        "rule",
        rule.id,
        key
      );
      if (!claimed) {
        summary.skipped++;
        continue;
      }

      const detail = await executeRule(supabase, rule, now);

      await supabase
        .from("automation_rules")
        .update({ last_run_at: now.toISOString() })
        .eq("id", rule.id);

      await recordResult(supabase, "rule", rule.id, key, "succes", detail);
      summary.rulesProcessed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      summary.errors.push(`Règle ${rule.id} : ${message}`);
      await recordResult(supabase, "rule", rule.id, key, "echec", message);
    }
  }
}

type RuleRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  kind: string;
  params: Record<string, unknown>;
  companies: { id: string; name: string } | null;
};

async function executeRule(
  supabase: SupabaseClient,
  rule: RuleRow,
  now: Date
): Promise<string> {
  switch (rule.kind) {
    case "briefing_matin":
      return briefingMatin(supabase, rule);
    case "compte_rendu_soir":
      return compteRenduSoir(supabase, rule);
    case "rapport_hebdo":
      return rapportHebdo(supabase, rule);
    case "relance_sans_reponse":
      return relanceSansReponse(supabase, rule);
    case "saisie_temps_manquante":
      return saisieTempsManquante(supabase, rule, now);
    default:
      return `Type de règle inconnu : ${rule.kind}`;
  }
}

async function briefingMatin(
  supabase: SupabaseClient,
  rule: RuleRow
): Promise<string> {
  const today = todayISODate();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, status, companies(name)")
    .eq("user_id", rule.user_id)
    .neq("status", "archivee")
    .neq("status", "terminee");

  const open = tasks ?? [];
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const urgent = open.filter((t) => t.priority === "urgente");

  const lines: string[] = [];
  if (overdue.length > 0) lines.push(`${overdue.length} en retard`);
  if (dueToday.length > 0) lines.push(`${dueToday.length} pour aujourd'hui`);
  if (urgent.length > 0) lines.push(`${urgent.length} urgente(s)`);

  const first = overdue[0] ?? dueToday[0] ?? urgent[0];
  const body =
    lines.length > 0
      ? `${lines.join(" · ")}.${first ? ` À commencer : « ${first.title} ».` : ""}`
      : "Rien d'urgent aujourd'hui. Bonne journée !";

  await notifyUser(supabase, rule.user_id, {
    title: "Briefing du matin",
    body,
    url: "/dashboard",
  });

  return body;
}

async function compteRenduSoir(
  supabase: SupabaseClient,
  rule: RuleRow
): Promise<string> {
  const today = todayISODate();
  const { data: entries } = await supabase
    .from("time_entries")
    .select("minutes")
    .eq("user_id", rule.user_id)
    .eq("entry_date", today);

  const minutes = (entries ?? []).reduce((s, e) => s + e.minutes, 0);
  const body =
    minutes > 0
      ? `${formatMinutes(minutes)} enregistrées aujourd'hui. Racontez le reste à MAW ?`
      : "Aucun temps enregistré aujourd'hui. Racontez votre journée à MAW en 30 secondes.";

  await notifyUser(supabase, rule.user_id, {
    title: "Compte rendu de la journée",
    body,
    url: "/dashboard",
  });

  return body;
}

/**
 * Prépare un BROUILLON de rapport — jamais d'envoi.
 *
 * La configuration de l'entreprise (`report_schedules`) décide de la période
 * (hebdomadaire ou mensuelle), des sections retenues et du format mis en
 * avant. En son absence, on retombe sur un hebdomadaire complet.
 */
async function rapportHebdo(
  supabase: SupabaseClient,
  rule: RuleRow
): Promise<string> {
  if (!rule.company_id || !rule.companies) {
    return "Règle sans entreprise : brouillon non préparé.";
  }

  const { data: schedule } = await supabase
    .from("report_schedules")
    .select("frequency, sections, default_format")
    .eq("company_id", rule.company_id)
    .maybeSingle();

  const isMonthly = schedule?.frequency === "mensuel";
  const period = isMonthly ? lastMonthPeriod() : lastWeekPeriod();

  // Idempotence métier : un seul rapport par entreprise et par période.
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("user_id", rule.user_id)
    .eq("company_id", rule.company_id)
    .eq("period_start", period.start)
    .eq("period_end", period.end)
    .maybeSingle();

  if (existing) {
    return "Un rapport existe déjà pour cette période.";
  }

  const facts = await fetchReportFacts(
    supabase,
    rule.user_id,
    rule.company_id,
    rule.companies.name,
    period
  );
  // Sections retenues par l'utilisateur, sinon celles par défaut.
  const content = defaultReportContent();
  const chosenSections = Array.isArray(schedule?.sections)
    ? (schedule.sections as string[])
    : null;
  if (chosenSections && chosenSections.length > 0) {
    content.sections = content.sections.map((section) => ({
      ...section,
      included: chosenSections.includes(section.key),
    }));
  }

  const title = buildReportTitle(
    isMonthly ? "mensuel" : "hebdomadaire",
    rule.companies.name,
    period
  );

  const { data: report } = await supabase
    .from("reports")
    .insert({
      user_id: rule.user_id,
      company_id: rule.company_id,
      type: isMonthly ? "mensuel" : "hebdomadaire",
      period_start: period.start,
      period_end: period.end,
      title,
      status: "brouillon",
      source_data: facts,
      content,
      whatsapp_text: formatWhatsAppMessage(facts, content),
      long_text: formatLongText(facts, content),
      generated_at: new Date().toISOString(),
      author_source: "ia",
    })
    .select("id")
    .single();

  await notifyUser(supabase, rule.user_id, {
    title: `Rapport prêt — ${rule.companies.name}`,
    body: `${facts.totals.completedCount} tâche(s) terminée(s), ${formatMinutes(facts.totals.totalMinutes)}. Relisez puis partagez.`,
    url: report ? `/rapports/${report.id}` : "/rapports",
  });

  return `Brouillon préparé : ${title}`;
}

async function relanceSansReponse(
  supabase: SupabaseClient,
  rule: RuleRow
): Promise<string> {
  const days = Number(rule.params?.jours ?? 3);
  const threshold = new Date(Date.now() - days * 86_400_000).toISOString();

  let query = supabase
    .from("tasks")
    .select("id, title, updated_at, company_id, companies(name)")
    .eq("user_id", rule.user_id)
    .eq("status", "en_attente_client")
    .lt("updated_at", threshold);

  if (rule.company_id) query = query.eq("company_id", rule.company_id);

  const { data } = await query.limit(20);
  const stale = data ?? [];
  if (stale.length === 0) return "Aucune relance nécessaire.";

  const first = stale[0];
  const companyName =
    (first.companies as { name?: string } | null)?.name ?? "un client";

  const body =
    stale.length === 1
      ? `« ${first.title} » attend une réponse de ${companyName} depuis plus de ${days} jours.`
      : `${stale.length} tâches attendent une réponse client depuis plus de ${days} jours.`;

  await notifyUser(supabase, rule.user_id, {
    title: "Relance à faire",
    body,
    url: first.company_id ? `/entreprises/${first.company_id}` : "/taches",
  });

  return body;
}

async function saisieTempsManquante(
  supabase: SupabaseClient,
  rule: RuleRow,
  now: Date
): Promise<string> {
  const days = Number(rule.params?.jours ?? 2);
  const since = new Date(now.getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { count } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", rule.user_id)
    .gte("entry_date", since);

  if ((count ?? 0) > 0) return "Du temps a été enregistré récemment.";

  const body = `Aucun temps enregistré depuis ${days} jours. Dictez-le à MAW, ça prend 20 secondes.`;
  await notifyUser(supabase, rule.user_id, {
    title: "Temps non enregistré",
    body,
    url: "/dashboard",
  });

  return body;
}
