import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { ReportGenerateDialog } from "@/components/reports/report-generate-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateShort } from "@/lib/dates";
import {
  currentMonthPeriod,
  currentWeekPeriod,
  formatPeriodLabel,
  lastMonthPeriod,
  lastWeekPeriod,
} from "@/lib/reports/periods";
import { createClient } from "@/lib/supabase/server";
import {
  reportStatusLabels,
  reportTypeLabels,
} from "@/lib/validations/reports";

export const metadata: Metadata = { title: "Rapports" };

type ReportRow = {
  id: string;
  title: string;
  type: keyof typeof reportTypeLabels;
  status: keyof typeof reportStatusLabels;
  period_start: string;
  period_end: string;
  generated_at: string | null;
  shared_at: string | null;
  companies: { name: string; color: string } | null;
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const [{ data: reports }, { data: companies }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, title, type, status, period_start, period_end, generated_at, shared_at, companies(name, color)")
      .neq("status", "archive")
      .order("period_end", { ascending: false })
      .limit(100),
    supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  const reportList = (reports ?? []) as unknown as ReportRow[];
  const companyList = companies ?? [];
  const presets = {
    lastWeek: lastWeekPeriod(),
    currentWeek: currentWeekPeriod(),
    lastMonth: lastMonthPeriod(),
    currentMonth: currentMonthPeriod(),
  };

  const lastWeekLabel = formatPeriodLabel(presets.lastWeek);
  const companiesWithoutReport = companyList.filter(
    (c) =>
      !reportList.some(
        (r) =>
          r.companies?.name === c.name &&
          r.period_start === presets.lastWeek.start &&
          r.period_end === presets.lastWeek.end
      )
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rapports</h1>
        {companyList.length > 0 ? (
          <ReportGenerateDialog companies={companyList} presets={presets}>
            <Button>
              <Plus aria-hidden />
              Générer
            </Button>
          </ReportGenerateDialog>
        ) : null}
      </div>

      {companyList.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <FileText
              className="mx-auto mb-2 size-8 text-muted-foreground"
              aria-hidden
            />
            <CardTitle>Aucune entreprise</CardTitle>
            <CardDescription>
              Créez une entreprise pour pouvoir générer des rapports.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {companiesWithoutReport.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rapports à préparer ({lastWeekLabel})
            </CardTitle>
            <CardDescription>
              Ces entreprises n&apos;ont pas encore de rapport pour la semaine
              écoulée.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {companiesWithoutReport.map((c) => (
              <ReportGenerateDialog
                key={c.id}
                companies={companyList}
                presets={presets}
                defaultCompanyId={c.id}
              >
                <Button variant="outline" size="sm">
                  <Plus aria-hidden />
                  {c.name}
                </Button>
              </ReportGenerateDialog>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {reportList.length === 0 ? (
        companyList.length > 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aucun rapport pour l&apos;instant. Générez-en un : il rassemblera
              automatiquement les faits de la période.
            </CardContent>
          </Card>
        ) : null
      ) : (
        <div className="flex flex-col gap-2">
          {reportList.map((report) => (
            <Link
              key={report.id}
              href={`/rapports/${report.id}`}
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-shadow hover:shadow-md">
                {report.companies ? (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: report.companies.color }}
                    aria-hidden
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {reportTypeLabels[report.type]} ·{" "}
                    {formatDateShort(report.period_start)} →{" "}
                    {formatDateShort(report.period_end)}
                    {report.shared_at
                      ? ` · partagé le ${formatDateShort(report.shared_at)}`
                      : ""}
                  </p>
                </div>
                <Badge
                  className={
                    report.status === "partage"
                      ? "bg-emerald-100 text-emerald-900"
                      : report.status === "pret"
                        ? "bg-brand-yellow/30 text-foreground"
                        : "bg-secondary text-secondary-foreground"
                  }
                >
                  {reportStatusLabels[report.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
