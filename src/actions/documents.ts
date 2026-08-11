"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_MIME_TYPES,
  documentLinkSchema,
  MAX_UPLOAD_BYTES,
  sanitizeFileName,
} from "@/lib/validations/documents";
import type { ActionResult } from "@/actions/companies";

const BUCKET = "documents";
/** Durée de validité des URL signées : 5 minutes. */
const SIGNED_URL_SECONDS = 300;

/** Enregistre un document de type « lien externe ». */
export async function createDocumentLink(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = documentLinkSchema.safeParse(input);
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

  const { data, error } = await supabase
    .from("company_documents")
    .insert({ ...parsed.data, type: "lien_externe", user_id: user.id })
    .select("id, name")
    .single();

  if (error) return { error: "Enregistrement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "document_ajoute",
    description: `Lien « ${data.name} » ajouté aux documents de ${company.name}.`,
    companyId: company.id,
    projectId: parsed.data.project_id ?? null,
    taskId: parsed.data.task_id ?? null,
  });

  revalidatePath("/documents");
  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

/**
 * Téléverse un fichier dans le bucket privé et enregistre ses métadonnées.
 * Chemin : <user_id>/<company_id>/<horodatage>-<nom nettoyé>
 */
export async function uploadDocument(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const file = formData.get("file");
  const companyId = String(formData.get("company_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const taskId = String(formData.get("task_id") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier sélectionné." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Fichier trop volumineux (25 Mo maximum)." };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: `Type de fichier non autorisé (${file.type || "inconnu"}).` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();
  if (!company) return { error: "Entreprise introuvable." };

  const storagePath = `${user.id}/${company.id}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: "Téléversement impossible : " + uploadError.message };
  }

  const { data, error } = await supabase
    .from("company_documents")
    .insert({
      user_id: user.id,
      company_id: company.id,
      project_id: projectId || null,
      task_id: taskId || null,
      name: name || file.name,
      description: description || null,
      type: "fichier",
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id, name")
    .single();

  if (error) {
    // Ne laisse pas de fichier orphelin si l'enregistrement échoue.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: "Enregistrement impossible : " + error.message };
  }

  await logActivity(supabase, user.id, {
    actionType: "document_ajoute",
    description: `Fichier « ${data.name} » ajouté aux documents de ${company.name}.`,
    companyId: company.id,
    projectId: projectId || null,
    taskId: taskId || null,
  });

  revalidatePath("/documents");
  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

/**
 * Génère une URL signée à durée limitée pour consulter un fichier privé.
 * L'appartenance est vérifiée avant toute signature.
 */
export async function getDocumentSignedUrl(
  documentId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: document } = await supabase
    .from("company_documents")
    .select("id, storage_path, type")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (!document?.storage_path) {
    return { error: "Document introuvable ou sans fichier associé." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);

  if (error || !data) {
    return { error: "Lien de téléchargement indisponible." };
  }

  return { data: { url: data.signedUrl } };
}

/** Archive un document (conservation par défaut). */
export async function setDocumentArchived(
  documentId: string,
  archived: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_documents")
    .update({ status: archived ? "archive" : "actif" })
    .eq("id", documentId)
    .eq("user_id", user.id)
    .select("id, name, company_id")
    .single();

  if (error || !data) return { error: "Document introuvable." };

  await logActivity(supabase, user.id, {
    actionType: archived ? "document_archive" : "document_reactive",
    description: `Document « ${data.name} » ${archived ? "archivé" : "réactivé"}.`,
    companyId: data.company_id,
  });

  revalidatePath("/documents");
  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

/** Suppression définitive : fichier de stockage + enregistrement. */
export async function deleteDocument(
  documentId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: document } = await supabase
    .from("company_documents")
    .select("id, name, company_id, storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();
  if (!document) return { error: "Document introuvable." };

  if (document.storage_path) {
    await supabase.storage.from(BUCKET).remove([document.storage_path]);
  }

  const { error } = await supabase
    .from("company_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) return { error: "Suppression impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: "document_supprime",
    description: `Document « ${document.name} » supprimé définitivement.`,
    companyId: document.company_id,
  });

  revalidatePath("/documents");
  revalidatePath(`/entreprises/${document.company_id}`);
  return { data: { id: documentId } };
}
