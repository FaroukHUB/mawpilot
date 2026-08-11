import type { Metadata } from "next";

import { ProfileForm } from "@/components/settings/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .single();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Connecté en tant que {user?.email ?? "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              full_name: profile?.full_name ?? "",
              timezone: profile?.timezone ?? "Europe/Paris",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assistant IA</CardTitle>
          <CardDescription>
            Les réglages de l&apos;assistant (modèles, voix) arrivent avec les
            phases 6 et 7.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
