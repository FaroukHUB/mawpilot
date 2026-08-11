import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { ChannelRow } from "@/components/contacts/channel-form-dialog";
import { ReportEditor } from "@/components/reports/report-editor";
import { Button } from "@/components/ui/button";
import {
  defaultReportContent,
  type ReportContent,
  type ReportFacts,
} from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rapport" };

export default async function ReportPage({
  params,
}: PageProps<"/rapports/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (!report) notFound();

  const [{ data: channels }, { data: deliveries }] = await Promise.all([
    supabase
      .from("company_channels")
      .select()
      .eq("company_id", report.company_id)
      .order("is_default", { ascending: false }),
    supabase
      .from("report_deliveries")
      .select("id, destination_label, method, status, delivered_at, created_at")
      .eq("report_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/rapports">
            <ArrowLeft aria-hidden />
            Tous les rapports
          </Link>
        </Button>
      </div>

      <ReportEditor
        reportId={report.id}
        initialTitle={report.title}
        initialStatus={report.status}
        initialWhatsAppText={report.whatsapp_text ?? ""}
        facts={report.source_data as ReportFacts}
        content={(report.content as ReportContent) ?? defaultReportContent()}
        channels={(channels ?? []) as ChannelRow[]}
        deliveries={deliveries ?? []}
      />
    </div>
  );
}
