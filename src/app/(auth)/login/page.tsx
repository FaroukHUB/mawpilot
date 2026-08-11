import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const suivant = typeof params.suivant === "string" ? params.suivant : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <LoginForm suivant={suivant} />
    </main>
  );
}
