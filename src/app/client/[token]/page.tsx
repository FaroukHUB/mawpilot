import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Hourglass,
  Loader2,
  TrendingUp,
} from "lucide-react";

import { ClientRequestPanel } from "@/components/client-portal/client-request-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  loadPortalMessages,
  loadPortalOverview,
  openPortalSession,
} from "@/lib/client-portal/data";

export const metadata: Metadata = {
  title: "Suivi de projet",
  robots: { index: false, follow: false, nocache: true },
};

// Toujours rendu à la demande : jamais mis en cache par la plateforme.
export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: PageProps<"/client/[token]">) {
  const { token } = await params;

  const session = await openPortalSession(token);
  if (!session) notFound();

  const [overview, messages] = await Promise.all([
    loadPortalOverview(session),
    loadPortalMessages(session),
  ]);

  const { settings } = session;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            className="size-4 rounded-full"
            style={{ backgroundColor: session.companyColor }}
            aria-hidden
          />
          <h1 className="text-2xl font-semibold">{session.companyName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {settings.welcomeMessage ??
            `Bonjour${session.contactName ? ` ${session.contactName}` : ""}, voici l'avancement de votre projet.`}
        </p>
      </header>

      {overview.waitingOnClient.length > 0 ? (
        <Card className="border-brand-orange bg-brand-orange/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hourglass className="size-4" aria-hidden />
              En attente de votre retour ({overview.waitingOnClient.length})
            </CardTitle>
            <CardDescription>
              Ces points nous bloquent : un mot de votre part et nous
              repartons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {overview.waitingOnClient.map((task) => (
                <li key={task.id} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-orange" />
                  {task.title}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ClientRequestPanel
        token={token}
        messages={messages}
        voiceEnabled={settings.voiceEnabled}
      />

      {overview.inProgress.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="size-4" aria-hidden />
              En cours ({overview.inProgress.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {overview.inProgress.map((task) => (
                <li key={task.id}>
                  {task.title}
                  {task.project ? (
                    <span className="text-muted-foreground"> · {task.project}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {overview.upcoming.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" aria-hidden />
              À venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {overview.upcoming.map((task) => (
                <li key={task.id} className="flex justify-between gap-3">
                  <span>{task.title}</span>
                  {task.dueOn ? (
                    <span className="shrink-0 text-muted-foreground">
                      {task.dueOn}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {overview.metrics.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" aria-hidden />
              Résultats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {overview.metrics.map((metric, index) => (
              <div key={index} className="rounded-lg border px-3 py-2">
                <p className="text-lg font-semibold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {overview.completed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
              Réalisé ({overview.completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {overview.completed.map((task) => (
                <li key={task.id} className="flex justify-between gap-3">
                  <span>{task.title}</span>
                  {task.completedOn ? (
                    <span className="shrink-0 text-muted-foreground">
                      {task.completedOn}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {overview.documents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden />
              Livrables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {overview.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3">
                  <span>{doc.name}</span>
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
                  ) : (
                    <span className="shrink-0 text-muted-foreground">
                      {doc.date}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {overview.reports.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comptes rendus</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {overview.reports.map((report) => (
              <div key={report.id} className="rounded-lg border px-3 py-2">
                <p className="text-sm font-medium">{report.title}</p>
                <p className="text-xs text-muted-foreground">{report.period}</p>
                {report.summary ? (
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {report.summary}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        Espace de suivi privé. Ce lien vous est personnel : merci de ne pas le
        partager.
      </footer>
    </main>
  );
}
