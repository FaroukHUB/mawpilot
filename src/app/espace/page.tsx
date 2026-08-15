import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Hourglass,
  Loader2,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">
          Bonjour {account.displayName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.welcomeMessage ?? "Voici où en est votre projet."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-1 py-3">
            <CardContent className="px-4">
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <nav aria-label="Sections" className="overflow-x-auto">
        <ul className="flex gap-1 border-b">
          {TABS.map((t) => (
            <li key={t.key} className="shrink-0">
              <a
                href={`/espace?onglet=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={`inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
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

          {data.metrics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4" aria-hidden />
                  Résultats
                </CardTitle>
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

      {tab === "demandes" ? (
        <ClientSpaceRequests
          requests={data.requests}
          voiceEnabled={data.voiceEnabled}
        />
      ) : null}

      {tab === "livrables" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Livrables ({data.documents.length})
            </CardTitle>
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
                      <p className="text-xs text-muted-foreground">{doc.date}</p>
                    </div>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                      >
                        Ouvrir
                        <ExternalLink className="size-3" aria-hidden />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" aria-hidden />
              Comptes rendus ({data.reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun compte rendu partagé pour l&apos;instant.
              </p>
            ) : (
              data.reports.map((report) => (
                <div key={report.id} className="rounded-lg border px-3 py-2.5">
                  <p className="text-sm font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.period}
                  </p>
                  {report.summary ? (
                    <p className="mt-1.5 text-sm whitespace-pre-wrap">
                      {report.summary}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
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
            <span className="shrink-0 text-xs text-muted-foreground">
              {task.dueOn}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
