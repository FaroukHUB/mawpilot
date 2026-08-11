import type { Metadata } from "next";
import { Bot, History, UserRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateLong, formatDateTime, toAppZone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Historique" };

type LogRow = {
  id: string;
  description: string;
  action_type: string;
  source: "manuelle" | "ia";
  created_at: string;
  companies: { name: string; color: string } | null;
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_logs")
    .select("id, description, action_type, source, created_at, companies(name, color)")
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (data ?? []) as unknown as LogRow[];

  // Regroupe par jour (fuseau Europe/Paris).
  const byDay = new Map<string, LogRow[]>();
  for (const log of logs) {
    const day = format(toAppZone(log.created_at), "yyyy-MM-dd");
    const list = byDay.get(day) ?? [];
    list.push(log);
    byDay.set(day, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Historique</h1>

      {logs.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <History
              className="mx-auto mb-2 size-8 text-muted-foreground"
              aria-hidden
            />
            <CardTitle>Aucune action enregistrée</CardTitle>
            <CardDescription>
              Chaque création, modification ou enregistrement de temps
              apparaîtra ici, de façon permanente.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        [...byDay.entries()].map(([day, dayLogs]) => (
          <section key={day} aria-label={formatDateLong(day)}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground first-letter:uppercase">
              {formatDateLong(day)}
            </h2>
            <Card className="py-2">
              <CardContent className="flex flex-col divide-y px-4">
                {dayLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 py-2.5">
                    {log.source === "ia" ? (
                      <Bot
                        className="size-4 shrink-0 text-brand-orange"
                        aria-label="Action de l'assistant IA"
                      />
                    ) : (
                      <UserRound
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-label="Action manuelle"
                      />
                    )}
                    {log.companies ? (
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: log.companies.color }}
                        title={log.companies.name}
                        aria-hidden
                      />
                    ) : null}
                    <p className="min-w-0 flex-1 text-sm">{log.description}</p>
                    <time
                      dateTime={log.created_at}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {formatDateTime(log.created_at).slice(-5)}
                    </time>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
