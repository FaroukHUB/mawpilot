"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { resourceSchema } from "@/lib/validations/resources";
import type { ActionResult } from "@/actions/companies";

export async function saveResource(
  input: unknown,
  resourceId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = resourceSchema.safeParse(input);
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

  const query = resourceId
    ? supabase
        .from("company_resources")
        .update(parsed.data)
        .eq("id", resourceId)
        .eq("user_id", user.id)
    : supabase
        .from("company_resources")
        .insert({ ...parsed.data, user_id: user.id });

  const { data, error } = await query.select("id, label").single();
  if (error) return { error: "Enregistrement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: resourceId ? "ressource_modifiee" : "ressource_creee",
    description: `Accès rapide « ${data.label} » ${resourceId ? "modifié" : "ajouté"} pour ${company.name}.`,
    companyId: company.id,
    after: { ...parsed.data, access_notes: undefined },
  });

  revalidatePath("/ressources");
  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

export async function toggleResourceFavorite(
  resourceId: string,
  isFavorite: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_resources")
    .update({ is_favorite: isFavorite })
    .eq("id", resourceId)
    .eq("user_id", user.id)
    .select("id, company_id")
    .single();

  if (error || !data) return { error: "Accès rapide introuvable." };

  revalidatePath("/ressources");
  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

/** Déplace une ressource dans l'ordre d'affichage de son entreprise. */
export async function moveResource(
  resourceId: string,
  direction: "up" | "down"
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data: current } = await supabase
    .from("company_resources")
    .select("id, company_id, category, sort_order")
    .eq("id", resourceId)
    .eq("user_id", user.id)
    .single();
  if (!current) return { error: "Accès rapide introuvable." };

  const { data: siblings } = await supabase
    .from("company_resources")
    .select("id, sort_order")
    .eq("company_id", current.company_id)
    .eq("category", current.category)
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");

  const list = siblings ?? [];
  const index = list.findIndex((r) => r.id === resourceId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= list.length) {
    return { data: { id: resourceId } };
  }

  // Réécrit des positions propres (0, 1, 2…) après permutation.
  const reordered = [...list];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[index],
  ];

  await Promise.all(
    reordered.map((r, i) =>
      supabase
        .from("company_resources")
        .update({ sort_order: i })
        .eq("id", r.id)
        .eq("user_id", user.id)
    )
  );

  revalidatePath("/ressources");
  revalidatePath(`/entreprises/${current.company_id}`);
  return { data: { id: resourceId } };
}

export async function setResourceActive(
  resourceId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_resources")
    .update({ is_active: isActive })
    .eq("id", resourceId)
    .eq("user_id", user.id)
    .select("id, label, company_id")
    .single();

  if (error || !data) return { error: "Accès rapide introuvable." };

  await logActivity(supabase, user.id, {
    actionType: isActive ? "ressource_reactivee" : "ressource_archivee",
    description: `Accès rapide « ${data.label} » ${isActive ? "réactivé" : "archivé"}.`,
    companyId: data.company_id,
  });

  revalidatePath("/ressources");
  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

/** Marque la ressource comme vérifiée aujourd'hui. */
export async function markResourceChecked(
  resourceId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_resources")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", resourceId)
    .eq("user_id", user.id)
    .select("id, company_id")
    .single();

  if (error || !data) return { error: "Accès rapide introuvable." };

  revalidatePath("/ressources");
  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}
