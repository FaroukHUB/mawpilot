"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/companies";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom est requis.").max(200),
  timezone: z.string().trim().min(1).max(64).default("Europe/Paris"),
});

export async function updateProfile(
  input: unknown
): Promise<ActionResult<{ full_name: string }>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("full_name")
    .single();

  if (error) return { error: "Mise à jour impossible : " + error.message };

  revalidatePath("/parametres");
  return { data };
}
