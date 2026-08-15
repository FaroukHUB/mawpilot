"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
import { getAppBaseUrl } from "@/lib/client-portal/base-url";
import { buildPortalUrl, generateToken } from "@/lib/client-portal/tokens";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

/** Actions du propriétaire sur le portail : liens, charte, demandes. */

const tokenSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  contact_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable())
    .nullable()
    .optional(),
  label: z.string().trim().min(1, "Donnez un nom au lien.").max(200),
  /** Durée de validité en jours. 0 = sans expiration. */
  expires_in_days: z.coerce.number().int().min(0).max(3650).default(180),
});

export async function createPortalLink(
  input: unknown
): Promise<ActionResult<{ url: string }>> {
  const parsed = tokenSchema.safeParse(input);
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

  const token = generateToken();
  const expiresAt =
    parsed.data.expires_in_days > 0
      ? new Date(
          Date.now() + parsed.data.expires_in_days * 86_400_000
        ).toISOString()
      : null;

  const { error } = await supabase.from("client_access_tokens").insert({
    user_id: user.id,
    company_id: company.id,
    contact_id: parsed.data.contact_id ?? null,
    label: parsed.data.label,
    token_prefix: token.prefix,
    token_hash: token.hash,
    expires_at: expiresAt,
  });

  if (error) return { error: "Création impossible : " + error.message };

  // La charte est créée avec des valeurs par défaut si elle n'existe pas.
  await supabase
    .from("client_portal_settings")
    .upsert(
      { company_id: company.id, user_id: user.id },
      { onConflict: "company_id", ignoreDuplicates: true }
    );

  await logActivity(supabase, user.id, {
    actionType: "lien_portail_cree",
    description: `Lien portail « ${parsed.data.label} » créé pour ${company.name}.`,
    companyId: company.id,
  });

  revalidatePath(`/entreprises/${company.id}`);

  // L'URL est déduite du domaine réel de la requête : un lien ne peut plus
  // pointer vers un domaine périmé si une variable d'environnement traîne.
  const baseUrl = await getAppBaseUrl();

  // Le lien complet n'est affiché QU'ICI, une seule fois : il n'est jamais
  // stocké en clair et ne pourra pas être réaffiché ensuite.
  return { data: { url: buildPortalUrl(token.fullToken, baseUrl) } };
}

export async function revokePortalLink(
  tokenId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("client_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", user.id)
    .select("id, label, company_id")
    .single();

  if (error || !data) return { error: "Lien introuvable." };

  await logActivity(supabase, user.id, {
    actionType: "lien_portail_revoque",
    description: `Lien portail « ${data.label} » révoqué.`,
    companyId: data.company_id,
  });

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

const settingsSchema = z.object({
  company_id: z.uuid(),
  is_enabled: z.coerce.boolean().default(true),
  welcome_message: z.string().max(1000).optional(),
  included_scope: z.string().max(4000).optional(),
  excluded_scope: z.string().max(4000).optional(),
  monthly_request_quota: z.coerce.number().int().min(0).max(1000).default(0),
  out_of_scope_message: z.string().trim().min(10).max(1000),
  quota_reached_message: z.string().trim().min(10).max(1000),
  tone: z.string().trim().min(3).max(200),
  ai_reply_enabled: z.coerce.boolean().default(true),
  voice_enabled: z.coerce.boolean().default(true),
  show_completed: z.coerce.boolean().default(true),
  show_in_progress: z.coerce.boolean().default(true),
  show_waiting_client: z.coerce.boolean().default(true),
  show_upcoming: z.coerce.boolean().default(true),
  show_documents: z.coerce.boolean().default(true),
  show_reports: z.coerce.boolean().default(true),
  show_metrics: z.coerce.boolean().default(true),
});

export async function savePortalSettings(
  input: unknown
): Promise<ActionResult<{ ok: true }>> {
  const parsed = settingsSchema.safeParse(input);
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
    .select("id")
    .eq("id", parsed.data.company_id)
    .eq("user_id", user.id)
    .single();
  if (!company) return { error: "Entreprise introuvable." };

  const { error } = await supabase
    .from("client_portal_settings")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "company_id" });

  if (error) return { error: "Enregistrement impossible : " + error.message };

  revalidatePath(`/entreprises/${parsed.data.company_id}`);
  return { data: { ok: true } };
}

// ---------------------------------------------------------------------------
// Traitement des demandes
// ---------------------------------------------------------------------------

const acceptSchema = z.object({
  request_id: z.uuid(),
  title: z.string().trim().min(1, "Le titre est requis.").max(300),
  /** Date communiquée au client — saisie et validée par l'utilisateur seul. */
  promised_date: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.iso.date("Date invalide.").nullable())
    .nullable()
    .optional(),
  billing_status: z
    .enum(["incluse", "supplementaire", "a_facturer"])
    .default("incluse"),
  /** Message envoyé au client, modifiable avant validation. */
  reply: z.string().trim().max(2000).optional(),
});

/**
 * Transforme une demande client en tâche réelle.
 * La date éventuellement communiquée provient EXCLUSIVEMENT de cette action,
 * donc d'une décision humaine — jamais de l'IA.
 */
export async function acceptClientRequest(
  input: unknown
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: request } = await supabase
    .from("client_requests")
    .select("id, company_id, content, companies(name)")
    .eq("id", parsed.data.request_id)
    .eq("user_id", user.id)
    .single();
  if (!request) return { error: "Demande introuvable." };

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      company_id: request.company_id,
      title: parsed.data.title,
      description: `Demande du client :\n${request.content}`,
      status: "a_faire",
      due_date: parsed.data.promised_date ?? null,
      billing_status: parsed.data.billing_status,
      source: "manuelle",
    })
    .select("id")
    .single();

  if (error || !task) {
    return { error: "Création de la tâche impossible." };
  }

  await supabase
    .from("client_requests")
    .update({
      status: "acceptee",
      task_id: task.id,
      promised_date: parsed.data.promised_date ?? null,
      promised_at: parsed.data.promised_date ? new Date().toISOString() : null,
    })
    .eq("id", request.id)
    .eq("user_id", user.id);

  // Réponse visible par le client dans son portail.
  const replyText =
    parsed.data.reply?.trim() ||
    (parsed.data.promised_date
      ? `C'est noté. Cette demande est planifiée pour le ${parsed.data.promised_date}.`
      : "C'est noté, la demande est prise en compte.");

  await supabase.from("client_messages").insert({
    user_id: user.id,
    company_id: request.company_id,
    request_id: request.id,
    author: "utilisateur",
    content: replyText,
  });

  await logActivity(supabase, user.id, {
    actionType: "demande_client_acceptee",
    description: `Demande client convertie en tâche « ${parsed.data.title} ».`,
    companyId: request.company_id,
    taskId: task.id,
  });

  revalidatePath("/demandes");
  revalidatePath("/taches");
  return { data: { taskId: task.id } };
}

export async function replyToClientRequest(
  requestId: string,
  message: string
): Promise<ActionResult<{ id: string }>> {
  const trimmed = message.trim();
  if (trimmed.length < 2) return { error: "Message trop court." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: request } = await supabase
    .from("client_requests")
    .select("id, company_id")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .single();
  if (!request) return { error: "Demande introuvable." };

  await supabase.from("client_messages").insert({
    user_id: user.id,
    company_id: request.company_id,
    request_id: request.id,
    author: "utilisateur",
    content: trimmed.slice(0, 2000),
  });

  revalidatePath("/demandes");
  return { data: { id: request.id } };
}

export async function setRequestStatus(
  requestId: string,
  status: "refusee" | "archivee" | "hors_forfait" | "en_analyse"
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("client_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) return { error: "Demande introuvable." };

  revalidatePath("/demandes");
  return { data: { id: data.id } };
}
