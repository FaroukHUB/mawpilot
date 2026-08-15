import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Hourglass,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { ClientAssistant } from "@/components/client-portal/client-assistant";
import { ClientSpaceRequests } from "@/components/client-portal/client-space-requests";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildClientStats,
  loadClientSpace,
  type ClientTask,
} from "@/lib/client-portal/client-data";
import { getClientAccount } from "@/lib/client-portal/session";

export const metadata: Metadata = { title: "Mon suivi" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "suivi", label: "Suivi" },
  { key: "assistant", label: "Assistant" },
  { key: "demandes", label: "Mes demandes" },
  { key: "livrables", label: "Livrables" },
  { key: "rapports", label: "Comptes rendus" },
] as const;

export default async function ClientSpacePage({
  searchParams,
}: PageProps<"/espace">) {
  const account = await getClientAccount();
  if (!account) redirect("/login");

  const params = await searchParams;
  const rawTab = typeof params.onglet === "string" ? params.onglet : "suivi";
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : "suivi";

  const data = await loadClientSpace(account);
  const stats = buildClientStats(data);
  const firstName = account.displayName.split(" ")[0];
  const lateTasks = [...data.inProgress, ...data.upcoming].filter((t) => t.isLate);

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête : où en est le dossier, en une phrase. */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: account.companyColor }}
          aria-hidden
        />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">Bonjour {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.welcomeMessage ??
                (data.lastActivityOn
                  ? `Dernière avancée sur votre projet le ${data.lastActivityOn}.`
                  : "Voici où en est votre projet.")}
            </p>
          </div>
          <ProgressRing value={data.overallProgress} />
        </div>

        <div className="grid grid-cols-2 border-t sm:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`px-4 py-3 ${index > 0 ? "border-l" : ""} ${
                index === 2 ? "border-t sm:border-t-0" : ""
              } ${index === 3 ? "border-t sm:border-t-0" : ""}`}
            >
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Sections" className="overflow-x-auto">
        <ul className="flex gap-1 border-b">
          {TABS.map((t) => (
            <li key={t.key} className="shrink-0">
              <a
                href={`/espace?onglet=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.key === "assistant" ? (
                  <Sparkles className="size-3.5" aria-hidden />
                ) : null}
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "suivi" ? (
        <div className="flex flex-col gap-4">
          {data.waitingOnClient.length > 0 ? (
            <Card className="border-brand-orange bg-brand-orange/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hourglass className="size-4" aria-hidden />
                  Ces points attendent votre retour
                </CardTitle>
                <CardDescription>
                  Un mot de votre part et nous repartons.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TaskList tasks={data.waitingOnClient} showDescription />
              </CardContent>
            </Card>
          ) : null}

          {data.nextDeadline || lateTasks.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.nextDeadline ? (
                <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Prochaine échéance
                    </p>
                    <p className="font-medium">{data.nextDeadline.title}</p>
                    {data.nextDeadline.dueOn ? (
                      <p className="text-sm text-muted-foreground">
                        {data.nextDeadline.dueOn}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {lateTasks.length > 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-brand-orange bg-brand-orange/5 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/20 text-orange-900">
                    <AlertTriangle className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-orange-900/80">
                      Échéance dépassée
                    </p>
                    <p className="font-medium">
                      {lateTasks.length} point{lateTasks.length > 1 ? "s" : ""} à
                      rattraper
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {lateTasks.map((t) => t.title).join(", ")}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {data.projects.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="size-4" aria-hidden />
                  Vos projets
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.projects.map((project) => (
                  <div key={project.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium">
                        {project.name}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {project.done}/{project.total} · {project.progress} %
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={project.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Avancement de ${project.name}`}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data.metrics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4" aria-hidden />
                  Résultats
                </CardTitle>
                <CardDescription>
                  Chiffres du dernier compte rendu.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.metrics.map((metric, index) => (
                  <div key={index} className="rounded-lg border px-3 py-2">
                    <p className="text-lg font-semibold">{metric.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="size-4" aria-hidden />
                En cours ({data.inProgress.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.inProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Rien en cours actuellement.
                </p>
              ) : (
                <TaskList tasks={data.inProgress} showDescription />
              )}
            </CardContent>
          </Card>

          {data.upcoming.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-4" aria-hidden />
                  À venir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList tasks={data.upcoming} showDate />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                Réalisé ({data.completed.length})
              </CardTitle>
              {data.completedThisMonth.length > 0 ? (
                <CardDescription>
                  Dont {data.completedThisMonth.length} ce mois-ci.
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              {data.completed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Le travail réalisé apparaîtra ici.
                </p>
              ) : (
                <TaskList tasks={data.completed} showCompleted />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "assistant" ? (
        <div className="flex flex-col gap-3">
          {data.includedScope ? (
            <p className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Inclus dans votre accompagnement :
              </span>{" "}
              {data.includedScope}
            </p>
          ) : null}
          <ClientAssistant
            messages={data.conversation}
            voiceEnabled={data.voiceEnabled}
            firstName={firstName}
          />
        </div>
      ) : null}

      {tab === "demandes" ? (
        <ClientSpaceRequests requests={data.requests} />
      ) : null}

      {tab === "livrables" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Livrables ({data.documents.length})
            </CardTitle>
            <CardDescription>
              Vos fichiers et liens, à consulter quand vous voulez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun livrable partagé pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{doc.name}</p>
                      {doc.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.description}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">{doc.date}</p>
                    </div>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                      >
                        {doc.isFile ? "Télécharger" : "Ouvrir"}
                        {doc.isFile ? (
                          <Download className="size-3" aria-hidden />
                        ) : (
                          <ExternalLink className="size-3" aria-hidden />
                        )}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "rapports" ? (
        <div className="flex flex-col gap-3">
          {data.reports.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">
                  Aucun compte rendu partagé pour l&apos;instant.
                </p>
              </CardContent>
            </Card>
          ) : (
            data.reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.period}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {report.sections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Compte rendu en cours de rédaction.
                    </p>
                  ) : (
                    report.sections.map((section, index) => (
                      <div key={index}>
                        <p className="text-sm font-semibold">{section.title}</p>
                        <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">
                          {section.text}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Anneau d'avancement global : lisible d'un coup d'œil. */
function ProgressRing({ value }: { value: number }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Avancement global : ${value} %`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-primary"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
          {value}%
        </span>
      </div>
      <span className="text-xs text-muted-foreground sm:hidden">
        Avancement global
      </span>
    </div>
  );
}

function TaskList({
  tasks,
  showDate = false,
  showCompleted = false,
  showDescription = false,
}: {
  tasks: ClientTask[];
  showDate?: boolean;
  showCompleted?: boolean;
  showDescription?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">{task.title}</p>
            {showDescription && task.description ? (
              <p className="mt-0.5 text-xs whitespace-pre-wrap text-muted-foreground">
                {task.description}
              </p>
            ) : null}
            {task.project ? (
              <Badge variant="secondary" className="mt-1">
                {task.project}
              </Badge>
            ) : null}
          </div>
          {showCompleted && task.completedOn ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {task.completedOn}
            </span>
          ) : null}
          {showDate && task.dueOn ? (
            <span
              className={`shrink-0 text-xs ${
                task.isLate ? "font-medium text-orange-700" : "text-muted-foreground"
              }`}
            >
              {task.dueOn}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
