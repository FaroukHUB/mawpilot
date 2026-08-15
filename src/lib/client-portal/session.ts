import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Rôle du compte connecté.
 *
 * Un compte présent dans `client_users` est un CLIENT : il accède à son
 * espace, jamais au tableau de bord. Tout autre compte connecté est le
 * propriétaire.
 */

export type ClientAccount = {
  clientUserId: string;
  companyId: string;
  companyName: string;
  companyColor: string;
  displayName: string;
};

export async function getClientAccount(): Promise<ClientAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("client_users")
    .select("id, company_id, display_name, companies(name, color)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  const rawCompany = data.companies as
    | { name: string; color: string }
    | { name: string; color: string }[]
    | null;
  const company = Array.isArray(rawCompany) ? rawCompany[0] : rawCompany;
  if (!company) return null;

  // Trace de dernière visite : utile pour savoir si le client s'en sert.
  await supabase
    .from("client_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    clientUserId: data.id,
    companyId: data.company_id,
    companyName: company.name,
    companyColor: company.color,
    displayName: data.display_name,
  };
}

/** Vrai si le compte connecté est un client (et non le propriétaire). */
export async function isClientAccount(): Promise<boolean> {
  return (await getClientAccount()) !== null;
}
