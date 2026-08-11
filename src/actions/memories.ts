"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logActivity } from "@/lib/activity";
// Les constantes vivent dans un module neutre : un fichier "use server" ne
// doit exporter QUE des fonctions asynchrones (voir src/lib/memories.ts).
import { MEMORY_CATEGORIES } from "@/lib/memories";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

const memorySchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  content: z.string().trim().min(1, "Le contenu est requis.").max(2000),
  category: z.enum(MEMORY_CATEGORIES).default("autre"),
  status: z.enum(["confirmee", "a_verifier"]).default("confirmee"),
});

/**
 * Enregistre une information durable saisie par l'utilisateur.
 * Source `utilisateur` : c'est une saisie explicite, jamais une déduction.
 */
export async function saveMemory(
  input: unknown,
  memoryId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = memorySchema.safeParse(input);
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

  const query = memoryId
    ? supabase
        .from("company_memories")
        .update(parsed.data)
        .eq("id", memoryId)
        .eq("user_id", user.id)
    : supabase
        .from("company_memories")
        .insert({ ...parsed.data, user_id: user.id, source: "utilisateur" });

  const { data, error } = await query.select("id, content").single();
  if (error) return { error: "Enregistrement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: memoryId ? "memoire_modifiee" : "memoire_enregistree",
    description: `Information ${memoryId ? "modifiée" : "retenue"} pour ${company.name} : « ${data.content.slice(0, 120)} »`,
    companyId: company.id,
  });

  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

/** Confirme une information proposée par l'IA (statut « à vérifier »). */
export async function confirmMemory(
  memoryId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_memories")
    .update({ status: "confirmee" })
    .eq("id", memoryId)
    .eq("user_id", user.id)
    .select("id, company_id")
    .single();

  if (error || !data) return { error: "Information introuvable." };

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

export async function setMemoryArchived(
  memoryId: string,
  archived: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_memories")
    .update({ is_archived: archived })
    .eq("id", memoryId)
    .eq("user_id", user.id)
    .select("id, company_id")
    .single();

  if (error || !data) return { error: "Information introuvable." };

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

/** Suppression définitive — confirmée côté interface. */
export async function deleteMemory(
  memoryId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: memory } = await supabase
    .from("company_memories")
    .select("id, content, company_id")
    .eq("id", memoryId)
    .eq("user_id", user.id)
    .single();
  if (!memory) return { error: "Information introuvable." };

  const { error } = await supabase
    .from("company_memories")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", user.id);
  if (error) return { error: "Suppression impossible." };

  await logActivity(supabase, user.id, {
    actionType: "memoire_supprimee",
    description: `Information supprimée : « ${memory.content.slice(0, 120)} »`,
    companyId: memory.company_id,
  });

  revalidatePath(`/entreprises/${memory.company_id}`);
  return { data: { id: memoryId } };
}
