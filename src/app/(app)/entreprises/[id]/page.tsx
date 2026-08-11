import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderKanban, Pencil, Plus } from "lucide-react";

import { CompanyArchiveButton } from "@/components/companies/company-archive-button";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { projectStatusLabels } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Company, Project, TaskWithRefs } from "@/types/database";

export const metadata: Metadata = { title: "Fiche entreprise" };

export default async function CompanyPage({
  params,
}: PageProps<"/entreprises/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single<Company>();

  if (!company) notFound();

  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase
      .from("projects")
      .select()
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, companies(id, name, color), projects(id, name)")
      .eq("company_id", id)
      .neq("status", "archivee")
      .order("created_at", { ascending: false }),
  ]);

  const projectList = (projects ?? []) as Project[];
  const taskList = (tasks ?? []) as unknown as TaskWithRefs[];
  const openTasks = taskList.filter((t) => t.status !== "terminee");
  const doneTasks = taskList.filter((t) => t.status === "terminee");

  const companyOption = [{ id: company.id, name: company.name }];
  const projectOptions = projectList.map((p) => ({
    id: p.id,
    name: p.name,
    company_id: p.company_id,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="size-4 rounded-full"
            style={{ backgroundColor: company.color }}
            aria-hidden
          />
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          {!company.is_active ? (
            <Badge variant="secondary">Archivée</Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          <CompanyFormDialog company={company}>
            <Button variant="outline" size="sm">
              <Pencil aria-hidden />
              Modifier
            </Button>
          </CompanyFormDialog>
          <CompanyArchiveButton
            companyId={company.id}
            isActive={company.is_active}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Contact : </span>
            {company.contact_name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email : </span>
            {company.contact_email ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Téléphone : </span>
            {company.contact_phone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Site : </span>
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {company.website}
              </a>
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Forfait mensuel : </span>
            {company.monthly_amount !== null
              ? `${company.monthly_amount} €`
              : "—"}
          </p>
          {company.included_services ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">
                Prestations incluses :{" "}
              </span>
              {company.included_services}
            </p>
          ) : null}
          {company.notes ? (
            <p className="sm:col-span-2 whitespace-pre-wrap">
              <span className="text-muted-foreground">Notes : </span>
              {company.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Projets ({projectList.length})</CardTitle>
          <ProjectFormDialog companyId={company.id}>
            <Button size="sm" variant="outline">
              <Plus aria-hidden />
              Projet
            </Button>
          </ProjectFormDialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {projectList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun projet. Les tâches peuvent aussi exister sans projet.
            </p>
          ) : (
            projectList.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <FolderKanban
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.description ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">
                  {projectStatusLabels[project.status]}
                </Badge>
                <ProjectFormDialog companyId={company.id} project={project}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Modifier le projet ${project.name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil aria-hidden />
                  </Button>
                </ProjectFormDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Tâches ouvertes ({openTasks.length})</CardTitle>
          <TaskFormDialog
            companies={companyOption}
            projects={projectOptions}
            defaultCompanyId={company.id}
          >
            <Button size="sm">
              <Plus aria-hidden />
              Tâche
            </Button>
          </TaskFormDialog>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune tâche ouverte pour cette entreprise.
            </p>
          ) : (
            openTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                companies={companyOption}
                projects={projectOptions}
                showCompany={false}
              />
            ))
          )}
        </CardContent>
      </Card>

      {doneTasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tâches terminées ({doneTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {doneTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                companies={companyOption}
                projects={projectOptions}
                showCompany={false}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
