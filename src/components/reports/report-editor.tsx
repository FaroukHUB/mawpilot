"use client";

import * as React from "react";
import {
  Check,
  Database,
  FileDown,
  Loader2,
  Mic,
  Plus,
  Printer,
  RefreshCw,
  Table2,
  Trash2,
} from "lucide-react";

import {
  regenerateWhatsAppText,
  saveReportDictation,
  updateReport,
} from "@/actions/reports";
import { VoiceRecorder } from "@/components/assistant/voice-recorder";
import { ReportSharePanel } from "@/components/reports/report-share-panel";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMinutes } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/reports/periods";
import {
  reportSectionLabels,
  type ReportContent,
  type ReportFacts,
  type ReportSectionKey,
} from "@/lib/reports/types";
import type { ChannelRow } from "@/components/contacts/channel-form-dialog";

/** Faits disponibles pour chaque section — sert à afficher « ce qui est enregistré ». */
function factsSummary(
  facts: ReportFacts,
  key: ReportSectionKey
): string[] {
  switch (key) {
    case "termine":
      return facts.completedTasks.map(
        (t) => `${t.title}${t.minutes > 0 ? ` — ${formatMinutes(t.minutes)}` : ""}`
      );
    case "en_cours":
      return facts.inProgressTasks.map((t) => t.title);
    case "blocages":
      return [
        ...facts.blockedTasks.map((t) => `${t.title} (bloquée)`),
        ...facts.waitingClientTasks.map((t) => `${t.title} (attente client)`),
      ];
    case "liens":
      return facts.documents.map(
        (d) => `${d.name}${d.external_url ? ` — ${d.external_url}` : ""}`
      );
    case "temps":
      return facts.totals.totalMinutes > 0
        ? [
            `Total : ${formatMinutes(facts.totals.totalMinutes)}`,
            ...(facts.totals.billableMinutes > 0
              ? [`Facturable : ${formatMinutes(facts.totals.billableMinutes)}`]
              : []),
          ]
        : [];
    case "prestations":
      return facts.unbilledTasks.map(
        (t) =>
          `${t.title}${t.amount !== null ? ` — ${t.amount.toFixed(2).replace(".", ",")} €` : ""}`
      );
    case "prochaines_actions":
      return facts.upcomingTasks.map(
        (t) => `${t.title}${t.due_date ? ` (${t.due_date})` : ""}`
      );
    case "tableau":
      return [
        `${
          facts.completedTasks.length +
          facts.inProgressTasks.length +
          facts.blockedTasks.length +
          facts.waitingClientTasks.length
        } ligne(s)`,
      ];
    default:
      return [];
  }
}

export function ReportEditor({
  reportId,
  initialTitle,
  initialStatus,
  initialWhatsAppText,
  facts,
  content: initialContent,
  channels,
  deliveries,
}: {
  reportId: string;
  initialTitle: string;
  initialStatus: string;
  initialWhatsAppText: string;
  facts: ReportFacts;
  content: ReportContent;
  channels: ChannelRow[];
  deliveries: {
    id: string;
    destination_label: string;
    method: string;
    status: string;
    delivered_at: string | null;
    created_at: string;
  }[];
}) {
  const [title, setTitle] = React.useState(initialTitle);
  const [status, setStatus] = React.useState(initialStatus);
  const [content, setContent] = React.useState<ReportContent>(initialContent);
  const [whatsappText, setWhatsappText] = React.useState(initialWhatsAppText);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Dictée : transcription brute conservée, version corrigée éditable.
  const [rawDictation, setRawDictation] = React.useState("");
  const [dictation, setDictation] = React.useState("");
  const [dictationNotice, setDictationNotice] = React.useState<string | null>(
    null
  );
  const [dictationTarget, setDictationTarget] =
    React.useState<ReportSectionKey>("resume");

  function insertDictation() {
    const text = dictation.trim();
    if (!text) return;
    setError(null);

    const target = content.sections.find((s) => s.key === dictationTarget);
    const merged = target?.text ? `${target.text}\n${text}` : text;
    updateSection(dictationTarget, { included: true, text: merged });

    startTransition(async () => {
      const result = await saveReportDictation(reportId, rawDictation, text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDictation("");
      setRawDictation("");
      setDictationNotice(
        `Texte inséré dans « ${reportSectionLabels[dictationTarget]} ». Pensez à enregistrer.`
      );
    });
  }

  function updateSection(key: ReportSectionKey, patch: Partial<{ included: boolean; text: string }>) {
    setSaved(false);
    setContent((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.key === key ? { ...s, ...patch } : s
      ),
    }));
  }

  function save(nextStatus = status) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateReport(reportId, {
        title,
        content,
        whatsapp_text: whatsappText,
        status: nextStatus,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(nextStatus);
      setSaved(true);
    });
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      // On enregistre d'abord le contenu courant pour que la régénération en tienne compte.
      const saveResult = await updateReport(reportId, {
        title,
        content,
        whatsapp_text: whatsappText,
        status,
      });
      if (saveResult.error) {
        setError(saveResult.error);
        return;
      }
      const result = await regenerateWhatsAppText(reportId);
      if (result.error || !result.data) {
        setError(result.error ?? "Régénération impossible.");
        return;
      }
      setWhatsappText(result.data.text);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Label htmlFor="report-title" className="sr-only">
              Titre du rapport
            </Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
              className="text-base font-semibold"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {facts.companyName} · {formatPeriodLabel(facts.period)} ·{" "}
              {facts.totals.completedCount} tâche(s) terminée(s) ·{" "}
              {formatMinutes(facts.totals.totalMinutes)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{status}</Badge>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/exports/${reportId}?format=docx`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown aria-hidden />
                DOCX
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/exports/${reportId}?format=xlsx`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Table2 aria-hidden />
                Excel
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/exports/${reportId}?format=csv`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown aria-hidden />
                CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/rapports/${reportId}/impression`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Printer aria-hidden />
                PDF / Imprimer
              </a>
            </Button>
            <Button size="sm" onClick={() => save()} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : saved ? (
                <Check aria-hidden />
              ) : null}
              Enregistrer
            </Button>
          </div>
        </CardHeader>
        {error ? (
          <CardContent>
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="size-4" aria-hidden />
            Dicter des précisions
          </CardTitle>
          <CardDescription>
            Parlez librement : la transcription s&apos;affiche ci-dessous pour
            correction, puis vous choisissez la section où l&apos;insérer. Rien
            n&apos;est ajouté au rapport sans votre validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <VoiceRecorder
            label="Dicter"
            onError={(message) => setError(message)}
            onTranscribed={({ text, costLabel }) => {
              setError(null);
              setRawDictation((prev) => (prev ? `${prev}\n${text}` : text));
              setDictation((prev) => (prev ? `${prev} ${text}` : text));
              setDictationNotice(
                `Transcription ajoutée${costLabel ? ` (${costLabel})` : ""} — corrigez-la avant de l'insérer.`
              );
            }}
          />
          {dictationNotice ? (
            <p className="text-xs text-muted-foreground">{dictationNotice}</p>
          ) : null}
          {dictation ? (
            <>
              <Textarea
                rows={4}
                value={dictation}
                onChange={(e) => setDictation(e.target.value)}
                aria-label="Transcription à corriger"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={dictationTarget}
                  onChange={(e) =>
                    setDictationTarget(e.target.value as ReportSectionKey)
                  }
                  aria-label="Section de destination"
                  className="w-auto"
                >
                  {content.sections
                    .filter((s) => s.key !== "tableau")
                    .map((s) => (
                      <option key={s.key} value={s.key}>
                        {reportSectionLabels[s.key]}
                      </option>
                    ))}
                </Select>
                <Button size="sm" onClick={insertDictation} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Check aria-hidden />
                  )}
                  Insérer dans la section
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDictation("");
                    setDictationNotice(null);
                  }}
                >
                  Effacer
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sections du rapport</CardTitle>
          <CardDescription>
            Les encadrés gris sont les <strong>faits enregistrés</strong> — ils
            ne sont jamais inventés. Vos commentaires viennent s&apos;y ajouter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {content.sections.map((section) => {
            const recorded = factsSummary(facts, section.key);
            return (
              <div
                key={section.key}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand-orange)]"
                    checked={section.included}
                    onChange={(e) =>
                      updateSection(section.key, { included: e.target.checked })
                    }
                  />
                  {reportSectionLabels[section.key]}
                  {recorded.length > 0 ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({recorded.length} élément{recorded.length > 1 ? "s" : ""})
                    </span>
                  ) : null}
                </label>

                {recorded.length > 0 ? (
                  <div className="rounded-md bg-muted/70 px-3 py-2">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Database className="size-3" aria-hidden />
                      Données enregistrées
                    </p>
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {recorded.slice(0, 8).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                      {recorded.length > 8 ? (
                        <li>… et {recorded.length - 8} de plus</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                {section.included && section.key !== "tableau" ? (
                  <Textarea
                    rows={2}
                    value={section.text}
                    onChange={(e) =>
                      updateSection(section.key, { text: e.target.value })
                    }
                    placeholder="Commentaire à ajouter (facultatif)…"
                    aria-label={`Commentaire pour ${reportSectionLabels[section.key]}`}
                  />
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indicateurs saisis</CardTitle>
            <CardDescription>
              Chiffres relevés à la main (Search Console, Analytics…). Ils sont
              affichés comme vos données, distincts des faits de
              l&apos;application.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {content.metrics.map((metric, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={metric.label}
                  placeholder="Clics Search Console"
                  aria-label="Libellé de l'indicateur"
                  onChange={(e) => {
                    const metrics = [...content.metrics];
                    metrics[index] = { ...metric, label: e.target.value };
                    setContent({ ...content, metrics });
                    setSaved(false);
                  }}
                />
                <Input
                  value={metric.value}
                  placeholder="+12 %"
                  aria-label="Valeur de l'indicateur"
                  onChange={(e) => {
                    const metrics = [...content.metrics];
                    metrics[index] = { ...metric, value: e.target.value };
                    setContent({ ...content, metrics });
                    setSaved(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer cet indicateur"
                  onClick={() => {
                    setContent({
                      ...content,
                      metrics: content.metrics.filter((_, i) => i !== index),
                    });
                    setSaved(false);
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent({
                  ...content,
                  metrics: [...content.metrics, { label: "", value: "" }],
                });
                setSaved(false);
              }}
            >
              <Plus aria-hidden />
              Ajouter un indicateur
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liens ajoutés</CardTitle>
            <CardDescription>
              URL à joindre au rapport (pages optimisées, livrables…).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {content.links.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={link.label}
                  placeholder="Fiche Bureau Alcôve"
                  aria-label="Libellé du lien"
                  onChange={(e) => {
                    const links = [...content.links];
                    links[index] = { ...link, label: e.target.value };
                    setContent({ ...content, links });
                    setSaved(false);
                  }}
                />
                <Input
                  value={link.url}
                  placeholder="https://…"
                  aria-label="URL du lien"
                  onChange={(e) => {
                    const links = [...content.links];
                    links[index] = { ...link, url: e.target.value };
                    setContent({ ...content, links });
                    setSaved(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer ce lien"
                  onClick={() => {
                    setContent({
                      ...content,
                      links: content.links.filter((_, i) => i !== index),
                    });
                    setSaved(false);
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setContent({
                  ...content,
                  links: [...content.links, { label: "", url: "" }],
                });
                setSaved(false);
              }}
            >
              <Plus aria-hidden />
              Ajouter un lien
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Message WhatsApp</CardTitle>
            <CardDescription>
              Version courte, modifiable avant partage.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Régénérer
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={14}
            value={whatsappText}
            onChange={(e) => {
              setWhatsappText(e.target.value);
              setSaved(false);
            }}
            aria-label="Message WhatsApp"
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <ReportSharePanel
        reportId={reportId}
        message={whatsappText}
        channels={channels}
        deliveries={deliveries}
        onBeforeShare={() => save("pret")}
      />
    </div>
  );
}
