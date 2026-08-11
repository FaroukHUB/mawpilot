"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { fetchReportFacts } from "@/lib/reports/collect";
import { formatLongText, formatWhatsAppMessage } from "@/lib/reports/format";
import { buildReportTitle } from "@/lib/reports/periods";
import {
  defaultReportContent,
  type ReportContent,
  type ReportFacts,
} from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";
import {
  generateReportSchema,
  prepareDeliverySchema,
  updateReportSchema,
} from "@/lib/validations/reports";
import type { ActionResult } from "@/actions/companies";

/**
 * Génère un rapport à partir des SEULES données enregistrées.
 * Les faits sont figés dans `source_data` au moment de la génération :
 * le rapport ne changera plus si les tâches évoluent ensuite.
 */
export async function generateReport(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = generateReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
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

  const period = {
    start: parsed.data.period_start,
    end: parsed.data.period_end,
  };

  const facts = await fetchReportFacts(
    supabase,
    user.id,
    company.id,
    company.name,
    period
  );

  const content = defaultReportContent();
  const title = buildReportTitle(parsed.data.type, company.name, period);

  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      company_id: company.id,
      type: parsed.data.type,
      period_start: period.start,
      period_end: period.end,
      title,
      status: "brouillon",
      source_data: facts,
      content,
      whatsapp_text: formatWhatsAppMessage(facts, content),
      long_text: formatLongText(facts, content),
      generated_at: new Date().toISOString(),
      author_source: "manuelle",
    })
    .select("id")
    .single();

  if (error) return { error: "Génération impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "rapport_genere",
    description: `${title} généré (${facts.totals.completedCount} tâche(s) terminée(s)).`,
    companyId: company.id,
  });

  revalidatePath("/rapports");
  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

/** Enregistre les modifications de contenu et régénère les textes. */
export async function updateReport(
  reportId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateReportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: report } = await supabase
    .from("reports")
    .select("id, company_id, source_data, status")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();
  if (!report) return { error: "Rapport introuvable." };

  const facts = report.source_data as ReportFacts;
  const content = parsed.data.content as ReportContent;

  const { error } = await supabase
    .from("reports")
    .update({
      title: parsed.data.title,
      content,
      status: parsed.data.status,
      // Le texte WhatsApp reste modifiable à la main : on ne l'écrase que
      // s'il est vide (l'utilisateur peut demander une régénération).
      whatsapp_text:
        parsed.data.whatsapp_text.trim() === ""
          ? formatWhatsAppMessage(facts, content)
          : parsed.data.whatsapp_text,
      long_text: formatLongText(facts, content),
    })
    .eq("id", reportId)
    .eq("user_id", user.id);

  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath("/rapports");
  revalidatePath(`/rapports/${reportId}`);
  return { data: { id: reportId } };
}

/** Régénère le message WhatsApp depuis les faits figés et le contenu courant. */
export async function regenerateWhatsAppText(
  reportId: string
): Promise<ActionResult<{ text: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: report } = await supabase
    .from("reports")
    .select("id, source_data, content")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();
  if (!report) return { error: "Rapport introuvable." };

  const text = formatWhatsAppMessage(
    report.source_data as ReportFacts,
    report.content as ReportContent
  );

  await supabase
    .from("reports")
    .update({ whatsapp_text: text })
    .eq("id", reportId)
    .eq("user_id", user.id);

  revalidatePath(`/rapports/${reportId}`);
  return { data: { text } };
}

/** Journalise une préparation de partage (statut « préparé »). */
export async function prepareDelivery(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = prepareDeliverySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: report } = await supabase
    .from("reports")
    .select("id, title, company_id")
    .eq("id", parsed.data.report_id)
    .eq("user_id", user.id)
    .single();
  if (!report) return { error: "Rapport introuvable." };

  const { data, error } = await supabase
    .from("report_deliveries")
    .insert({
      user_id: user.id,
      report_id: report.id,
      company_channel_id: parsed.data.company_channel_id ?? null,
      destination_label: parsed.data.destination_label,
      method: parsed.data.method,
      prepared_content: parsed.data.prepared_content,
      status: "prepare",
    })
    .select("id")
    .single();

  if (error) return { error: "Préparation impossible : " + error.message };

  revalidatePath(`/rapports/${report.id}`);
  return { data: { id: data.id } };
}

/**
 * Confirme l'envoi — action strictement manuelle.
 * Rien ne marque jamais un rapport comme envoyé automatiquement.
 */
export async function confirmDeliverySent(
  deliveryId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: delivery, error } = await supabase
    .from("report_deliveries")
    .update({
      status: "confirme_envoye",
      delivered_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("user_id", user.id)
    .select("id, report_id, destination_label")
    .single();

  if (error || !delivery) return { error: "Partage introuvable." };

  const { data: report } = await supabase
    .from("reports")
    .update({ status: "partage", shared_at: new Date().toISOString() })
    .eq("id", delivery.report_id)
    .eq("user_id", user.id)
    .select("id, title, company_id")
    .single();

  if (report) {
    await logActivity(supabase, user.id, {
      actionType: "rapport_partage",
      description: `${report.title} confirmé envoyé à « ${delivery.destination_label} ».`,
      companyId: report.company_id,
    });
    revalidatePath(`/entreprises/${report.company_id}`);
  }

  revalidatePath("/rapports");
  revalidatePath(`/rapports/${delivery.report_id}`);
  return { data: { id: delivery.id } };
}

/** Archive un rapport (jamais de suppression silencieuse). */
export async function archiveReport(
  reportId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("reports")
    .update({ status: "archive" })
    .eq("id", reportId)
    .eq("user_id", user.id)
    .select("id, title, company_id")
    .single();

  if (error || !data) return { error: "Rapport introuvable." };

  await logActivity(supabase, user.id, {
    actionType: "rapport_archive",
    description: `${data.title} archivé.`,
    companyId: data.company_id,
  });

  revalidatePath("/rapports");
  return { data: { id: data.id } };
}
