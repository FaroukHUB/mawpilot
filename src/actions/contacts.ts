"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import { channelSchema, contactSchema } from "@/lib/validations/contacts";
import type { ActionResult } from "@/actions/companies";

async function requireUserAndCompany(companyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, company: null } as const;

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  return { supabase, user, company } as const;
}

export async function saveContact(
  input: unknown,
  contactId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const { supabase, user, company } = await requireUserAndCompany(
    parsed.data.company_id
  );
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  if (!company) return { error: "Entreprise introuvable." };

  const query = contactId
    ? supabase
        .from("company_contacts")
        .update(parsed.data)
        .eq("id", contactId)
        .eq("user_id", user.id)
    : supabase
        .from("company_contacts")
        .insert({ ...parsed.data, user_id: user.id });

  const { data, error } = await query.select("id, name").single();
  if (error) return { error: "Enregistrement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: contactId ? "contact_modifie" : "contact_cree",
    description: `Contact « ${data.name} » ${contactId ? "modifié" : "ajouté"} pour ${company.name}.`,
    companyId: company.id,
    after: parsed.data,
  });

  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

export async function setContactActive(
  contactId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_contacts")
    .update({ is_active: isActive })
    .eq("id", contactId)
    .eq("user_id", user.id)
    .select("id, name, company_id")
    .single();

  if (error || !data) return { error: "Contact introuvable." };

  await logActivity(supabase, user.id, {
    actionType: isActive ? "contact_reactive" : "contact_archive",
    description: `Contact « ${data.name} » ${isActive ? "réactivé" : "archivé"}.`,
    companyId: data.company_id,
  });

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}

export async function saveChannel(
  input: unknown,
  channelId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = channelSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const { supabase, user, company } = await requireUserAndCompany(
    parsed.data.company_id
  );
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  if (!company) return { error: "Entreprise introuvable." };

  // Un seul canal par défaut par entreprise (contrainte unique en base) :
  // on retire le drapeau des autres avant d'enregistrer.
  if (parsed.data.is_default) {
    await supabase
      .from("company_channels")
      .update({ is_default: false })
      .eq("company_id", company.id)
      .eq("user_id", user.id);
  }

  const query = channelId
    ? supabase
        .from("company_channels")
        .update(parsed.data)
        .eq("id", channelId)
        .eq("user_id", user.id)
    : supabase
        .from("company_channels")
        .insert({ ...parsed.data, user_id: user.id });

  const { data, error } = await query.select("id, label").single();
  if (error) return { error: "Enregistrement impossible : " + error.message };

  await logActivity(supabase, user.id, {
    actionType: channelId ? "canal_modifie" : "canal_cree",
    description: `Destination « ${data.label} » ${channelId ? "modifiée" : "ajoutée"} pour ${company.name}.`,
    companyId: company.id,
    after: parsed.data,
  });

  revalidatePath(`/entreprises/${company.id}`);
  return { data: { id: data.id } };
}

export async function setChannelActive(
  channelId: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("company_channels")
    .update({ is_active: isActive, ...(isActive ? {} : { is_default: false }) })
    .eq("id", channelId)
    .eq("user_id", user.id)
    .select("id, label, company_id")
    .single();

  if (error || !data) return { error: "Destination introuvable." };

  await logActivity(supabase, user.id, {
    actionType: isActive ? "canal_reactive" : "canal_archive",
    description: `Destination « ${data.label} » ${isActive ? "réactivée" : "archivée"}.`,
    companyId: data.company_id,
  });

  revalidatePath(`/entreprises/${data.company_id}`);
  return { data: { id: data.id } };
}
