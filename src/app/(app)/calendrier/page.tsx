import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { now, todayISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendrier" };

type CalTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  companies: { name: string; color: string } | null;
};

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendrier">) {
  const params = await searchParams;
  const monthParam = typeof params.mois === "string" ? params.mois : "";
  const reference = /^\d{4}-\d{2}$/.test(monthParam)
    ? parse(monthParam, "yyyy-MM", now())
    : now();

  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, companies(name, color)")
    .neq("status", "archivee")
    .gte("due_date", format(gridStart, "yyyy-MM-dd"))
    .lte("due_date", format(gridEnd, "yyyy-MM-dd"))
    .order("priority", { ascending: false });

  const tasks = (data ?? []) as unknown as CalTask[];
  const byDate = new Map<string, CalTask[]>();
  for (const t of tasks) {
    const list = byDate.get(t.due_date) ?? [];
    list.push(t);
    byDate.set(t.due_date, list);
  }

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d);
  }
  const today = todayISODate();
  const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");
  const monthLabel = format(monthStart, "LLLL yyyy", { locale: fr });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendrier</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link
              href={`/calendrier?mois=${prevMonth}`}
              aria-label="Mois précédent"
            >
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <span className="min-w-36 text-center font-medium first-letter:uppercase">
            {monthLabel}
          </span>
          <Button variant="outline" size="icon" asChild>
            <Link
              href={`/calendrier?mois=${nextMonth}`}
              aria-label="Mois suivant"
            >
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="py-3">
        <CardContent className="px-3">
          <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold text-muted-foreground">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="pb-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border">
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const dayTasks = byDate.get(iso) ?? [];
              const inMonth = isSameMonth(day, monthStart);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-24 bg-background p-1.5",
                    !inMonth && "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <p
                    className={cn(
                      "mb-1 text-xs font-medium",
                      isToday &&
                        "inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </p>
                  <div className="flex flex-col gap-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <Link
                        key={t.id}
                        href={`/taches?periode=&statut=${t.status}`}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                          t.status === "terminee"
                            ? "bg-muted text-muted-foreground line-through"
                            : t.priority === "urgente"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-accent text-accent-foreground"
                        )}
                        title={`${t.title}${t.companies ? ` — ${t.companies.name}` : ""}`}
                      >
                        {t.companies ? (
                          <span
                            className="mr-1 inline-block size-1.5 rounded-full align-middle"
                            style={{ backgroundColor: t.companies.color }}
                            aria-hidden
                          />
                        ) : null}
                        {t.title}
                      </Link>
                    ))}
                    {dayTasks.length > 3 ? (
                      <p className="px-1 text-[11px] text-muted-foreground">
                        +{dayTasks.length - 3} autres
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Les tâches apparaissent à leur date d&apos;échéance. Les tâches sans
        échéance sont visibles dans la vue liste des tâches.
      </p>
    </div>
  );
}
