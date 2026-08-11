import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Euro,
  Hourglass,
  ListTodo,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatMinutes,
  formatRelative,
  monthStartISODate,
  todayISODate,
  weekEndISODate,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tableau de bord" };

type DashTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  billing_status: string;
  amount: number | null;
  company_id: string;
  companies: { name: string; color: string } | null;
};

type DashTime = {
  minutes: number;
  company_id: string;
  companies: { name: string; color: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISODate();
  const monthStart = monthStartISODate();
  const weekEnd = weekEndISODate();

  const [{ data: rawTasks }, { data: rawTime }, { data: rawLogs }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, title, status, priority, due_date, completed_at, billing_status, amount, company_id, companies(name, color)"
        )
        .neq("status", "archivee"),
      supabase
        .from("time_entries")
        .select("minutes, company_id, companies(name, color)")
        .gte("entry_date", monthStart),
      supabase
        .from("activity_logs")
        .select("id, description, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const tasks = (rawTasks ?? []) as unknown as DashTask[];
  const timeEntries = (rawTime ?? []) as unknown as DashTime[];
  const logs = rawLogs ?? [];

  const open = tasks.filter((t) => t.status !== "terminee");
  const urgent = open.filter((t) => t.priority === "urgente");
  const overdue = open.filter((t) => t.due_date !== null && t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const dueThisWeek = open.filter(
    (t) => t.due_date !== null && t.due_date >= today && t.due_date <= weekEnd
  );
  const waitingClient = open.filter((t) => t.status === "en_attente_client");
  const doneThisMonth = tasks.filter(
    (t) => t.completed_at !== null && t.completed_at >= monthStart
  );
  const toBill = tasks.filter((t) => t.billing_status === "a_facturer");
  const toBillTotal = toBill.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const minutesThisMonth = timeEntries.reduce((sum, e) => sum + e.minutes, 0);

  // Charge par entreprise : temps du mois + tâches ouvertes.
  const byCompany = new Map<
    string,
    { name: string; color: string; minutes: number; openTasks: number }
  >();
  for (const e of timeEntries) {
    if (!e.companies) continue;
    const entry = byCompany.get(e.company_id) ?? {
      ...e.companies,
      minutes: 0,
      openTasks: 0,
    };
    entry.minutes += e.minutes;
    byCompany.set(e.company_id, entry);
  }
  for (const t of open) {
    if (!t.companies) continue;
    const entry = byCompany.get(t.company_id) ?? {
      ...t.companies,
      minutes: 0,
      openTasks: 0,
    };
    entry.openTasks += 1;
    byCompany.set(t.company_id, entry);
  }
  const companyLoad = [...byCompany.entries()].sort(
    (a, b) => b[1].minutes - a[1].minutes
  );

  const stats = [
    {
      label: "À faire",
      value: open.length,
      icon: ListTodo,
      href: "/taches",
      accent: "",
    },
    {
      label: "Urgentes",
      value: urgent.length,
      icon: AlertTriangle,
      href: "/taches?priorite=urgente",
      accent: urgent.length > 0 ? "text-destructive" : "",
    },
    {
      label: "En retard",
      value: overdue.length,
      icon: CalendarClock,
      href: "/taches?periode=retard",
      accent: overdue.length > 0 ? "text-destructive" : "",
    },
    {
      label: "Attente client",
      value: waitingClient.length,
      icon: Hourglass,
      href: "/taches?statut=en_attente_client",
      accent: "",
    },
    {
      label: "Terminées ce mois",
      value: doneThisMonth.length,
      icon: CheckCircle2,
      href: "/taches",
      accent: "text-emerald-600",
    },
    {
      label: "Temps ce mois",
      value: formatMinutes(minutesThisMonth),
      icon: Clock,
      href: "/taches",
      accent: "",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, icon: Icon, href, accent }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full gap-1 py-3 transition-shadow hover:shadow-md">
              <CardContent className="px-4">
                <Icon
                  className={`mb-1 size-4 text-muted-foreground ${accent}`}
                  aria-hidden
                />
                <p className={`text-xl font-semibold ${accent}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden />
              Aujourd&apos;hui et cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {dueToday.length === 0 && dueThisWeek.length === 0 ? (
              <p className="text-muted-foreground">
                Aucune échéance cette semaine.
              </p>
            ) : (
              <>
                {dueToday.map((t) => (
                  <TaskLine key={t.id} task={t} badge="Aujourd'hui" urgent />
                ))}
                {dueThisWeek
                  .filter((t) => t.due_date !== today)
                  .map((t) => (
                    <TaskLine key={t.id} task={t} />
                  ))}
              </>
            )}
            {overdue.length > 0 ? (
              <p className="mt-2 text-sm font-medium text-destructive">
                ⚠ {overdue.length} tâche{overdue.length > 1 ? "s" : ""} en
                retard —{" "}
                <Link href="/taches?periode=retard" className="underline">
                  voir
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" aria-hidden />
              Charge par entreprise (ce mois)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {companyLoad.length === 0 ? (
              <p className="text-muted-foreground">
                Aucun temps enregistré ce mois-ci.
              </p>
            ) : (
              companyLoad.map(([id, c]) => (
                <div key={id} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.openTasks} ouverte{c.openTasks > 1 ? "s" : ""}
                  </span>
                  <span className="w-16 text-right font-medium">
                    {formatMinutes(c.minutes)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="size-4" aria-hidden />À facturer
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {toBill.length === 0 ? (
              <p className="text-muted-foreground">
                Aucune prestation en attente de facturation.
              </p>
            ) : (
              <>
                {toBill.map((t) => (
                  <TaskLine key={t.id} task={t} showAmount />
                ))}
                <p className="mt-1 border-t pt-2 text-right font-semibold">
                  Total : {toBillTotal.toFixed(2).replace(".", ",")} €
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">
                Aucune activité pour l&apos;instant.
              </p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1">{log.description}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(log.created_at)}
                  </span>
                </div>
              ))
            )}
            <Link
              href="/historique"
              className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Voir tout l&apos;historique →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TaskLine({
  task,
  badge,
  urgent = false,
  showAmount = false,
}: {
  task: DashTask;
  badge?: string;
  urgent?: boolean;
  showAmount?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {task.companies ? (
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.companies.color }}
          title={task.companies.name}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {showAmount ? (
        <span className="shrink-0 font-medium">
          {task.amount !== null
            ? `${task.amount.toFixed(2).replace(".", ",")} €`
            : "montant à définir"}
        </span>
      ) : null}
      {badge ? (
        <Badge
          className={
            urgent
              ? "bg-brand-orange/20 text-orange-900"
              : "bg-secondary text-secondary-foreground"
          }
        >
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}
