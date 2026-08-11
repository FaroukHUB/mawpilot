"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = {
  error: string | null;
};

/** Connexion par email + mot de passe. L'inscription publique est fermée. */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message volontairement générique : ne pas révéler si l'email existe.
    return { error: "Email ou mot de passe incorrect." };
  }

  const suivant = formData.get("suivant");
  const destination =
    typeof suivant === "string" && suivant.startsWith("/") && !suivant.startsWith("//")
      ? suivant
      : "/dashboard";

  redirect(destination);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
