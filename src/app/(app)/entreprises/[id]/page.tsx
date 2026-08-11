import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, FileText, FolderKanban, Pencil, Plus } from "lucide-react";

import { CompanyArchiveButton } from "@/components/companies/company-archive-button";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { ContactsPanel } from "@/components/contacts/contacts-panel";
import type { ChannelRow } from "@/components/contacts/channel-form-dialog";
import type { ContactRow } from "@/components/contacts/contact-form-dialog";
import {
  DocumentsPanel,
  type DocumentRow,
} from "@/components/documents/documents-panel";
import { ReportGenerateDialog } from "@/components/reports/report-generate-dialog";
import { ResourcesPanel } from "@/components/resources/resources-panel";
import type { ResourceRow } from "@/components/resources/resource-form-dialog";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import { TimeEntryDialog } from "@/components/time/time-entry-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDateShort,
  formatMinutes,
  formatRelative,
  monthStartISODate,
} from "@/lib/dates";
import { projectStatusLabels } from "@/lib/labels";
import {
  currentMonthPeriod,
  currentWeekPeriod,
  lastMonthPeriod,
  lastWeekPeriod,
} from "@/lib/reports/periods";
import { reportStatusLabels } from "@/lib/validations/reports";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Company, Project, TaskWithRefs } from "@/types/database";

export const metadata: Metadata = { title: "Fiche entreprise" };

const TABS = [
  { key: "apercu", label: "Vue d'ensemble" },
  { key: "projets", label: "Projets & tâches" },
  { key: "rapports", label: "Rapports" },
  { key: "contacts", label: "Contacts & WhatsApp" },
  { key: "documents", label: "Documents" },
  { key: "acces", label: "Accès rapides" },
  { key: "historique", label: "Historique" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function CompanyPage({
  params,
  searchParams,
}: PageProps<"/entreprises/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const rawTab = typeof sp.onglet === "string" ? sp.onglet : "apercu";
  const tab: TabKey = (TABS.some((t) => t.key === rawTab) ? rawTab : "apercu") as TabKey;

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select()
    .eq("id", id)
    .single<Company>();

  if (!company) notFound();

  const monthStart = monthStartISODate();
  const [
    { data: projects },
    { data: tasks },
    { data: timeMonth },
    { data: logs },
    { data: contacts },
    { data: channels },
    { data: resources },
    { data: documents },
    { data: reports },
  ] = await Promise.all([
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
    supabase
      .from("time_entries")
      .select("minutes")
      .eq("company_id", id)
      .gte("entry_date", monthStart),
    supabase
      .from("activity_logs")
      .select("id, description, created_at, source")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(tab === "historique" ? 100 : 6),
    supabase
      .from("company_contacts")
      .select()
      .eq("company_id", id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("company_channels")
      .select()
      .eq("company_id", id)
      .order("is_default", { ascending: false })
      .order("label"),
    supabase
      .from("company_resources")
      .select()
      .eq("company_id", id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("company_documents")
      .select()
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id, title, status, period_start, period_end")
      .eq("company_id", id)
      .neq("status", "archive")
      .order("period_end", { ascending: false })
      .limit(30),
  ]);

  const projectList = (projects ?? []) as Project[];
  const taskList = (tasks ?? []) as unknown as TaskWithRefs[];
  const openTasks = taskList.filter((t) => t.status !== "terminee");
  const doneTasks = taskList.filter((t) => t.status === "terminee");
  const urgentTasks = openTasks.filter((t) => t.priority === "urgente");
  const toBill = taskList.filter((t) => t.billing_status === "a_facturer");
  const toBillTotal = toBill.reduce((s, t) => s + (t.amount ?? 0), 0);
  const minutesMonth = (timeMonth ?? []).reduce((s, e) => s + e.minutes, 0);

  const companyOption = [{ id: company.id, name: company.name }];
  const reportPresets = {
    lastWeek: lastWeekPeriod(),
    currentWeek: currentWeekPeriod(),
    lastMonth: lastMonthPeriod(),
    currentMonth: currentMonthPeriod(),
  };
  const projectOptions = projectList.map((p) => ({
    id: p.id,
    name: p.name,
    company_id: p.company_id,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
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
        <div className="flex flex-wrap gap-2">
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
          <TimeEntryDialog companyId={company.id}>
            <Button size="sm" variant="outline">
              <Clock aria-hidden />
              Temps
            </Button>
          </TimeEntryDialog>
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

      <nav aria-label="Sections de la fiche" className="overflow-x-auto">
        <ul className="flex gap-1 border-b">
          {TABS.map((t) => (
            <li key={t.key} className="shrink-0">
              <Link
                href={`/entreprises/${company.id}?onglet=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "apercu" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Contact : </span>
                {company.contact_name ?? "—"}
                {company.contact_email ? ` · ${company.contact_email}` : ""}
                {company.contact_phone ? ` · ${company.contact_phone}` : ""}
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
                <p className="whitespace-pre-wrap">
                  <span className="text-muted-foreground">
                    Prestations incluses :{" "}
                  </span>
                  {company.included_services}
                </p>
              ) : null}
              {company.notes ? (
                <p className="whitespace-pre-wrap">
                  <span className="text-muted-foreground">Notes : </span>
                  {company.notes}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="gap-1 py-3">
                <CardContent className="px-4">
                  <p className="text-xl font-semibold">{openTasks.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Tâches ouvertes
                  </p>
                </CardContent>
              </Card>
              <Card className="gap-1 py-3">
                <CardContent className="px-4">
                  <p className="text-xl font-semibold">
                    {formatMinutes(minutesMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Temps ce mois
                  </p>
                </CardContent>
              </Card>
              <Card className="gap-1 py-3">
                <CardContent className="px-4">
                  <p className="text-xl font-semibold">
                    {toBillTotal > 0
                      ? `${toBillTotal.toFixed(0)} €`
                      : toBill.length}
                  </p>
                  <p className="text-xs text-muted-foreground">À facturer</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Urgences</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {urgentTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune tâche urgente.
                  </p>
                ) : (
                  urgentTasks.map((task) => (
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

            <Card>
              <CardHeader>
                <CardTitle>Activité récente</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {(logs ?? []).length === 0 ? (
                  <p className="text-muted-foreground">
                    Aucune activité enregistrée.
                  </p>
                ) : (
                  (logs ?? []).map((log) => (
                    <div key={log.id} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1">{log.description}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(log.created_at)}
                      </span>
                    </div>
                  ))
                )}
                <Link
                  href={`/entreprises/${company.id}?onglet=historique`}
                  className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Voir tout →
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "projets" ? (
        <div className="flex flex-col gap-4">
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
                      <p className="truncate text-sm font-medium">
                        {project.name}
                      </p>
                      {project.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {projectStatusLabels[project.status]}
                    </Badge>
                    <ProjectFormDialog
                      companyId={company.id}
                      project={project}
                    >
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
              <Link
                href={`/taches?entreprise=${company.id}`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Vue complète avec filtres →
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {openTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune tâche ouverte.
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
                {doneTasks.slice(0, 30).map((task) => (
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
      ) : null}

      {tab === "historique" ? (
        <Card className="py-2">
          <CardContent className="flex flex-col divide-y px-4">
            {(logs ?? []).length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Aucune action enregistrée pour cette entreprise.
              </p>
            ) : (
              (logs ?? []).map((log) => (
                <div key={log.id} className="flex items-baseline gap-3 py-2.5">
                  <p className="min-w-0 flex-1 text-sm">{log.description}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(log.created_at)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "contacts" ? (
        <ContactsPanel
          companyId={company.id}
          contacts={(contacts ?? []) as ContactRow[]}
          channels={(channels ?? []) as ChannelRow[]}
        />
      ) : null}

      {tab === "acces" ? (
        <ResourcesPanel
          companyId={company.id}
          resources={(resources ?? []) as ResourceRow[]}
          showArchived
        />
      ) : null}

      {tab === "documents" ? (
        <DocumentsPanel
          companyId={company.id}
          documents={(documents ?? []) as DocumentRow[]}
        />
      ) : null}

      {tab === "rapports" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Rapports ({(reports ?? []).length})</CardTitle>
            <ReportGenerateDialog
              companies={companyOption}
              presets={reportPresets}
              defaultCompanyId={company.id}
            >
              <Button size="sm">
                <Plus aria-hidden />
                Générer
              </Button>
            </ReportGenerateDialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(reports ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun rapport pour cette entreprise. Générez-en un : il
                rassemblera automatiquement les faits de la période.
              </p>
            ) : (
              (reports ?? []).map((report) => (
                <Link
                  key={report.id}
                  href={`/rapports/${report.id}`}
                  className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-shadow hover:shadow-md">
                    <FileText
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {report.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(report.period_start)} →{" "}
                        {formatDateShort(report.period_end)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {reportStatusLabels[
                        report.status as keyof typeof reportStatusLabels
                      ] ?? report.status}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
