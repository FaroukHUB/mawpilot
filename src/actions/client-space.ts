"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { loadBudgetSettings } from "@/lib/ai/budget";
import { computeCost } from "@/lib/ai/pricing";
import { analyseClientRequest } from "@/lib/client-portal/assistant";
import { loadAssistantContext } from "@/lib/client-portal/client-data";
import { getClientAccount } from "@/lib/client-portal/session";
import { notifyUser } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFileName } from "@/lib/validations/documents";
import type { ActionResult } from "@/actions/companies";

/**
 * Conversation de l'espace client connecté.
 *
 * Le client parle ou écrit ; l'assistant répond, puis classe : une vraie
 * demande devient une ligne de suivi côté prestataire, une simple question
 * reste une question. Aucune date n'est jamais promise ici — seul le
 * prestataire s'engage (voir acceptClientRequest).
 */

const messageSchema = z.object({
  message: z.string().trim().min(2, "Message trop court.").max(2000),
  is_voice: z.coerce.boolean().default(false),
  /** Pièces jointes déjà téléversées, à rattacher à cette demande. */
  attachment_ids: z.array(z.uuid()).max(6).default([]),
});

const MAX_MESSAGES_PER_HOUR = 20;

const BUCKET = "documents";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_HOUR = 20;

/** Photos et documents : de quoi illustrer une demande, rien d'exécutable. */
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type ClientAttachment = {
  id: string;
  name: string;
  mimeType: string;
  isImage: boolean;
};

/**
 * Téléverse une pièce jointe du client dans le bucket privé.
 *
 * Le client n'a aucun droit sur le Storage : tout passe par ici, où le type
 * et la taille sont vérifiés côté serveur. Le fichier est rattaché à la
 * demande au moment de l'envoi du message.
 */
export async function uploadClientAttachment(
  formData: FormData
): Promise<ActionResult<ClientAttachment>> {
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier sélectionné." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "Fichier trop lourd (10 Mo maximum)." };
  }
  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return {
      error: "Formats acceptés : photo (JPG, PNG, WEBP, HEIC) ou PDF.",
    };
  }

  const account = await getClientAccount();
  if (!account) return { error: "Session expirée, reconnectez-vous." };

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("client_users")
    .select("owner_user_id")
    .eq("id", account.clientUserId)
    .single();
  if (!link) return { error: "Compte introuvable." };

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await admin
    .from("client_attachments")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_HOUR) {
    return { error: "Trop de fichiers envoyés coup sur coup. Réessayez plus tard." };
  }

  // Chemin sous le dossier du prestataire : la politique Storage existante
  // lui donne alors accès au fichier sans traitement particulier.
  const storagePath = `${link.owner_user_id}/clients/${account.companyId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: "Envoi du fichier impossible. Réessayez." };
  }

  const { data, error } = await admin
    .from("client_attachments")
    .insert({
      user_id: link.owner_user_id,
      company_id: account.companyId,
      uploaded_by: "client",
      name: file.name.slice(0, 200),
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id, name, mime_type")
    .single();

  if (error || !data) {
    // Le fichier ne doit pas rester orphelin dans le bucket.
    await admin.storage.from(BUCKET).remove([storagePath]);
    return {
      error:
        "Enregistrement impossible. Si le problème persiste, prévenez votre prestataire.",
    };
  }

  return {
    data: {
      id: data.id,
      name: data.name,
      mimeType: data.mime_type,
      isImage: data.mime_type.startsWith("image/"),
    },
  };
}

export type SpaceReply = {
  reply: string;
  /** Vrai si le message a été enregistré comme demande à traiter. */
  requestCreated: boolean;
  requestId: string | null;
  outOfScope: boolean;
};

export async function sendSpaceMessage(
  input: unknown
): Promise<ActionResult<SpaceReply>> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Message invalide." };
  }

  const account = await getClientAccount();
  if (!account) return { error: "Session expirée, reconnectez-vous." };

  const admin = createAdminClient();

  // Le propriétaire du dossier : c'est lui qu'on notifie.
  const { data: link } = await admin
    .from("client_users")
    .select("owner_user_id")
    .eq("id", account.clientUserId)
    .single();
  if (!link) return { error: "Compte introuvable." };

  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recent } = await admin
    .from("client_messages")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .eq("author", "client")
    .gte("created_at", oneHourAgo);

  if ((recent ?? 0) >= MAX_MESSAGES_PER_HOUR) {
    return {
      error:
        "Vous avez envoyé beaucoup de messages coup sur coup. Reprenons dans un moment.",
    };
  }

  // 1. Le message du client est enregistré avant tout traitement : même si
  //    l'IA échoue, rien n'est perdu.
  const { data: clientMessage } = await admin
    .from("client_messages")
    .insert({
      user_id: link.owner_user_id,
      company_id: account.companyId,
      author: "client",
      content: parsed.data.message,
    })
    .select("id")
    .single();

  // Les pièces jointes déjà téléversées rejoignent ce message. On restreint à
  // l'entreprise du client et aux fichiers encore libres : un identifiant
  // deviné ne peut pas déplacer la pièce jointe d'un autre.
  const attachmentIds = parsed.data.attachment_ids;
  if (attachmentIds.length > 0 && clientMessage) {
    await admin
      .from("client_attachments")
      .update({ message_id: clientMessage.id })
      .in("id", attachmentIds)
      .eq("company_id", account.companyId)
      .is("message_id", null);
  }

  const { data: history } = await admin
    .from("client_messages")
    .select("author, content")
    .eq("company_id", account.companyId)
    .order("created_at", { ascending: false })
    .limit(11);

  const { data: settingsRow } = await admin
    .from("client_portal_settings")
    .select("*")
    .eq("company_id", account.companyId)
    .maybeSingle();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: monthlyCount } = await admin
    .from("client_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", account.companyId)
    .gte("created_at", monthStart.toISOString());

  const quota = settingsRow?.monthly_request_quota ?? 0;
  const quotaReached = quota > 0 && (monthlyCount ?? 0) >= quota;

  const overview = await loadAssistantContext(account.companyId);

  const session = {
    tokenId: "",
    userId: link.owner_user_id,
    companyId: account.companyId,
    companyName: account.companyName,
    companyColor: account.companyColor,
    contactName: account.displayName,
    settings: {
      isEnabled: true,
      welcomeMessage: settingsRow?.welcome_message ?? null,
      includedScope: settingsRow?.included_scope ?? null,
      excludedScope: settingsRow?.excluded_scope ?? null,
      monthlyRequestQuota: quota,
      outOfScopeMessage:
        settingsRow?.out_of_scope_message ??
        "Cette demande sort des prestations incluses. Je la transmets pour étude.",
      quotaReachedMessage:
        settingsRow?.quota_reached_message ??
        "Vous avez atteint le nombre de demandes incluses ce mois-ci.",
      tone: settingsRow?.tone ?? "professionnel et chaleureux",
      aiReplyEnabled: settingsRow?.ai_reply_enabled ?? true,
      voiceEnabled: settingsRow?.voice_enabled ?? true,
      showCompleted: true,
      showInProgress: true,
      showWaitingClient: true,
      showUpcoming: true,
      showDocuments: true,
      showReports: true,
      showMetrics: true,
    },
  };

  let analysis;
  try {
    analysis = await analyseClientRequest({
      session,
      overview,
      message: parsed.data.message,
      // Le dernier élément est le message qu'on vient d'enregistrer.
      history: (history ?? []).slice(1).reverse(),
      quotaReached,
    });
  } catch (error) {
    console.error("Analyse de message (espace client) :", error);
    analysis = {
      reply:
        "Votre message est bien enregistré. Vous recevrez une réponse rapidement.",
      classification: "indeterminee" as const,
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
  }

  // 2. Une simple question ne crée pas de ligne de suivi : seules les vraies
  //    demandes entrent dans la file du prestataire.
  const isRequest = analysis.classification !== "question";
  const outOfScope =
    quotaReached || analysis.classification === "supplementaire";

  let requestId: string | null = null;
  if (isRequest) {
    const { data: request } = await admin
      .from("client_requests")
      .insert({
        user_id: link.owner_user_id,
        company_id: account.companyId,
        contact_name: account.displayName,
        content: parsed.data.message,
        is_voice: parsed.data.is_voice,
        classification: analysis.classification,
        assistant_reply: analysis.reply,
        status: outOfScope ? "hors_forfait" : "en_analyse",
      })
      .select("id")
      .single();
    requestId = request?.id ?? null;

    if (requestId && attachmentIds.length > 0) {
      await admin
        .from("client_attachments")
        .update({ request_id: requestId })
        .in("id", attachmentIds)
        .eq("company_id", account.companyId)
        .is("request_id", null);
    }
  }

  // 3. Réponse de l'assistant conservée dans le fil.
  await admin.from("client_messages").insert({
    user_id: link.owner_user_id,
    company_id: account.companyId,
    request_id: requestId,
    author: "assistant",
    content: analysis.reply,
  });

  if (analysis.usage.inputTokens > 0) {
    const budget = await loadBudgetSettings(admin, link.owner_user_id);
    await admin.from("ai_requests").insert({
      user_id: link.owner_user_id,
      user_message: `[espace client — ${account.companyName}] ${parsed.data.message.slice(0, 400)}`,
      input_mode: parsed.data.is_voice ? "ia_voix" : "ia_texte",
      intent: "demande_client",
      status: "executee",
      input_tokens: analysis.usage.inputTokens,
      cached_input_tokens: analysis.usage.cachedInputTokens,
      output_tokens: analysis.usage.outputTokens,
      cost_usd: computeCost(analysis.usage, budget.rates),
    });
  }

  await notifyUser(admin, link.owner_user_id, {
    title: outOfScope
      ? `Demande hors forfait — ${account.companyName}`
      : isRequest
        ? `Nouvelle demande — ${account.companyName}`
        : `Question client — ${account.companyName}`,
    body:
      `${account.displayName} : ${parsed.data.message.slice(0, 160)}` +
      (attachmentIds.length > 0
        ? ` · ${attachmentIds.length} pièce${attachmentIds.length > 1 ? "s" : ""} jointe${attachmentIds.length > 1 ? "s" : ""}`
        : ""),
    url: "/demandes",
    alwaysEmail: outOfScope,
  });

  revalidatePath("/espace");
  revalidatePath("/demandes");

  return {
    data: {
      reply: analysis.reply,
      requestCreated: requestId !== null,
      requestId,
      outOfScope,
    },
  };
}
