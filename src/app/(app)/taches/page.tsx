import type { Metadata } from "next";
import { ListChecks, Plus } from "lucide-react";

import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskRow } from "@/components/tasks/task-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  monthStartISODate,
  todayISODate,
  weekEndISODate,
} from "@/lib/dates";
import {
  BILLING_STATUSES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/enums";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRefs } from "@/types/database";

export const metadata: Metadata = { title: "Tâches" };

function pick(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function TasksPage({
  searchParams,
}: PageProps<"/taches">) {
  const params = await searchParams;
  const supabase = await createClient();

  const filters = {
    entreprise: pick(params.entreprise),
    projet: pick(params.projet),
    statut: pick(params.statut),
    priorite: pick(params.priorite),
    categorie: pick(params.categorie),
    facturation: pick(params.facturation),
    periode: pick(params.periode),
    vue: pick(params.vue) === "kanban" ? "kanban" : "liste",
  };

  let query = supabase
    .from("tasks")
    .select("*, companies(id, name, color), projects(id, name)")
    .neq("status", "archivee")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.entreprise) query = query.eq("company_id", filters.entreprise);
  if (filters.projet) query = query.eq("project_id", filters.projet);
  if (filters.statut && (TASK_STATUSES as readonly string[]).includes(filters.statut)) {
    query = query.eq("status", filters.statut);
  }
  if (filters.priorite && (TASK_PRIORITIES as readonly string[]).includes(filters.priorite)) {
    query = query.eq("priority", filters.priorite);
  }
  if (filters.categorie && (TASK_CATEGORIES as readonly string[]).includes(filters.categorie)) {
    query = query.eq("category", filters.categorie);
  }
  if (filters.facturation && (BILLING_STATUSES as readonly string[]).includes(filters.facturation)) {
    query = query.eq("billing_status", filters.facturation);
  }

  const today = todayISODate();
  if (filters.periode === "retard") {
    query = query.lt("due_date", today).neq("status", "terminee");
  } else if (filters.periode === "aujourdhui") {
    query = query.eq("due_date", today);
  } else if (filters.periode === "semaine") {
    query = query.gte("due_date", today).lte("due_date", weekEndISODate());
  } else if (filters.periode === "mois") {
    query = query.gte("due_date", monthStartISODate());
  }

  const [{ data: tasks }, { data: companies }, { data: projects }] =
    await Promise.all([
      query,
      supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase.from("projects").select("id, name, company_id").order("name"),
    ]);

  const taskList = (tasks ?? []) as unknown as TaskWithRefs[];
  const companyOptions = companies ?? [];
  const projectOptions = projects ?? [];
  const openTasks = taskList.filter((t) => t.status !== "terminee");
  const doneTasks = taskList
    .filter((t) => t.status === "terminee")
    .slice(0, 20);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tâches</h1>
        {companyOptions.length > 0 ? (
          <TaskFormDialog companies={companyOptions} projects={projectOptions}>
            <Button>
              <Plus aria-hidden />
              Ajouter
            </Button>
          </TaskFormDialog>
        ) : null}
      </div>

      {companyOptions.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <ListChecks
              className="mx-auto mb-2 size-8 text-muted-foreground"
              aria-hidden
            />
            <CardTitle>Commence par créer une entreprise</CardTitle>
            <CardDescription>
              Chaque tâche appartient à une entreprise : ajoute d&apos;abord ta
              première entreprise dans l&apos;onglet « Entreprises ».
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <TaskFilters companies={companyOptions} projects={projectOptions} />

          {filters.vue === "kanban" ? (
            <TaskKanban
              tasks={taskList}
              companies={companyOptions}
              projects={projectOptions}
            />
          ) : (
            <>
              <section
                aria-label="Tâches ouvertes"
                className="flex flex-col gap-2"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Ouvertes ({openTasks.length})
                </h2>
                {openTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-4 text-sm text-muted-foreground">
                      Aucune tâche ne correspond aux filtres.
                    </CardContent>
                  </Card>
                ) : (
                  openTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      companies={companyOptions}
                      projects={projectOptions}
                    />
                  ))
                )}
              </section>

              {doneTasks.length > 0 ? (
                <section
                  aria-label="Tâches terminées récemment"
                  className="flex flex-col gap-2"
                >
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Terminées récemment
                  </h2>
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      companies={companyOptions}
                      projects={projectOptions}
                    />
                  ))}
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
