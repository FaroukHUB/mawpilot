import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlarmClock, Bell, History, Wand2 } from "lucide-react";

import { AutomationRules } from "@/components/notifications/automation-rules";
import { NotificationList } from "@/components/notifications/notification-list";
import { PushToggle } from "@/components/notifications/push-toggle";
import { ReminderList } from "@/components/notifications/reminder-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rappels" };

export default async function RemindersPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [
    { data: reminders },
    { data: rules },
    { data: notifications },
    { data: companies },
    { data: runs },
  ] = await Promise.all([
    supabase
      .from("reminders")
      .select("*, companies(name)")
      .eq("status", "actif")
      .order("next_run_at")
      .limit(50),
    supabase
      .from("automation_rules")
      .select("*, companies(name)")
      .order("kind")
      .limit(50),
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("automation_runs")
      .select("id, source_type, occurrence_key, status, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Rappels et automatisations</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" aria-hidden />
            Notifications
          </CardTitle>
          <CardDescription>
            Activez les notifications pour être prévenu même lorsque
            l&apos;application est fermée. Un email de secours est envoyé si
            aucun appareil n&apos;est joignable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PushToggle
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          />
          <NotificationList notifications={notifications ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlarmClock className="size-4" aria-hidden />
            Rappels programmés ({(reminders ?? []).length})
          </CardTitle>
          <CardDescription>
            Dites simplement « rappelle-moi vendredi à 15 h de relancer Djamel »
            au bouton « Parler à MAW ».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderList
            reminders={reminders ?? []}
            companies={companies ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-4" aria-hidden />
            Automatisations
          </CardTitle>
          <CardDescription>
            Elles ne produisent que des notifications et des brouillons : aucun
            message n&apos;est jamais envoyé à un client automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationRules rules={rules ?? []} companies={companies ?? []} />
        </CardContent>
      </Card>

      {(runs ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" aria-hidden />
              Historique d&apos;exécution
            </CardTitle>
            <CardDescription>
              Trace de chaque déclenchement — utile pour vérifier que le
              planificateur tourne bien.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-sm">
            {(runs ?? []).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-baseline gap-2 border-b pb-1.5 last:border-0"
              >
                <span
                  className={
                    run.status === "echec"
                      ? "font-medium text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {run.status === "echec" ? "Échec" : "OK"}
                </span>
                <span className="min-w-0 flex-1">
                  {run.detail ?? run.occurrence_key}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(run.created_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
