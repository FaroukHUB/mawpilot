import type { Metadata } from "next";
import { ListChecks, Plus } from "lucide-react";

import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRefs } from "@/types/database";

export const metadata: Metadata = { title: "Tâches" };

export default async function TasksPage() {
  const supabase = await createClient();

  const [{ data: tasks }, { data: companies }, { data: projects }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("*, companies(id, name, color), projects(id, name)")
        .neq("status", "archivee")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("is_active", true).order("name"),
      supabase.from("projects").select("id, name, company_id").order("name"),
    ]);

  const taskList = (tasks ?? []) as unknown as TaskWithRefs[];
  const openTasks = taskList.filter((t) => t.status !== "terminee");
  const doneTasks = taskList.filter((t) => t.status === "terminee").slice(0, 20);
  const companyOptions = companies ?? [];
  const projectOptions = projects ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
          <section aria-label="Tâches ouvertes" className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Ouvertes ({openTasks.length})
            </h2>
            {openTasks.length === 0 ? (
              <Card>
                <CardContent className="py-4 text-sm text-muted-foreground">
                  Aucune tâche ouverte. Profites-en ou ajoutes-en une !
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
    </div>
  );
}
