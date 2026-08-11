"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  Brain,
  Check,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import {
  confirmMemory,
  deleteMemory,
  MEMORY_CATEGORIES,
  memoryCategoryLabels,
  saveMemory,
  setMemoryArchived,
} from "@/actions/memories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort } from "@/lib/dates";

export type MemoryRow = {
  id: string;
  company_id: string;
  content: string;
  category: (typeof MEMORY_CATEGORIES)[number];
  source: "utilisateur" | "ia_confirmee" | "donnees";
  status: "confirmee" | "a_verifier";
  is_archived: boolean;
  created_at: string;
};

const sourceLabels: Record<MemoryRow["source"], string> = {
  utilisateur: "Vous",
  ia_confirmee: "Assistant (confirmé)",
  donnees: "Déduit des données",
};

export function MemoriesPanel({
  companyId,
  memories,
}: {
  companyId: string;
  memories: MemoryRow[];
}) {
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState<string>("consigne");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const active = memories.filter((m) => !m.is_archived);
  const archived = memories.filter((m) => m.is_archived);

  function add() {
    if (content.trim() === "") return;
    setError(null);
    startTransition(async () => {
      const result = await saveMemory({
        company_id: companyId,
        content,
        category,
        status: "confirmee",
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setContent("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4" aria-hidden />
            Mémoire de l&apos;assistant
          </CardTitle>
          <CardDescription>
            Consignes et informations durables sur cette entreprise. Les tâches,
            temps et rapports ne sont pas ici : l&apos;assistant les lit
            directement dans vos données.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="Ex. : envoyer le rapport le vendredi avant 17 h, dans le groupe Suivi SEO."
            aria-label="Nouvelle information à retenir"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Catégorie"
              className="w-auto"
            >
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {memoryCategoryLabels[c]}
                </option>
              ))}
            </Select>
            <Button onClick={add} disabled={isPending || content.trim() === ""}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              Retenir
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {active.length === 0 && archived.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aucune information retenue pour cette entreprise.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {[...active, ...archived].map((memory) => (
            <div
              key={memory.id}
              className={`flex flex-wrap items-start gap-3 rounded-lg border bg-card px-3 py-2.5 ${
                memory.is_archived ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm">{memory.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {memoryCategoryLabels[memory.category]} ·{" "}
                  {sourceLabels[memory.source]} ·{" "}
                  {formatDateShort(memory.created_at)}
                </p>
              </div>
              {memory.status === "a_verifier" ? (
                <>
                  <Badge className="bg-brand-yellow/30 text-foreground">
                    À vérifier
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await confirmMemory(memory.id);
                      })
                    }
                  >
                    <Check aria-hidden />
                    Confirmer
                  </Button>
                </>
              ) : null}
              {memory.is_archived ? (
                <Badge variant="secondary">Archivée</Badge>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={
                  memory.is_archived
                    ? "Réactiver cette information"
                    : "Archiver cette information"
                }
                onClick={() =>
                  startTransition(async () => {
                    await setMemoryArchived(memory.id, !memory.is_archived);
                  })
                }
              >
                {memory.is_archived ? (
                  <ArchiveRestore aria-hidden />
                ) : (
                  <Archive aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label="Supprimer définitivement cette information"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Supprimer définitivement cette information ? L'archivage est préférable."
                    )
                  ) {
                    return;
                  }
                  startTransition(async () => {
                    const result = await deleteMemory(memory.id);
                    if (result.error) setError(result.error);
                  });
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
