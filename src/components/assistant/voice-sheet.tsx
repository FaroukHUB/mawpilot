"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";

import {
  askAssistant,
  cancelAiActions,
  confirmAiActions,
  getOrCreateGlobalConversation,
  type AskResult,
} from "@/actions/ai";
import { VoiceRecorder } from "@/components/assistant/voice-recorder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/ai/pricing";

/**
 * Parcours vocal complet, accessible depuis n'importe quelle page :
 * dicter → corriger → analyser → prévisualiser → confirmer → résumé.
 *
 * Une seule dictée peut produire plusieurs actions ; rien n'est enregistré
 * avant la confirmation, et tout s'exécute d'un bloc.
 */

type Step = "dicter" | "analyse" | "confirmer" | "resume";

export function VoiceSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("dicter");
  const [text, setText] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AskResult | null>(null);
  const [executed, setExecuted] = React.useState<{ description: string }[]>([]);
  const [isPending, startTransition] = React.useTransition();

  function reset() {
    setStep("dicter");
    setText("");
    setNotice(null);
    setError(null);
    setResult(null);
    setExecuted([]);
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Laisse l'animation de fermeture se terminer avant de vider l'écran.
      setTimeout(reset, 200);
    }
  }

  function analyse() {
    const message = text.trim();
    if (!message) return;
    setError(null);
    setStep("analyse");

    startTransition(async () => {
      const conversation = await getOrCreateGlobalConversation();
      if (conversation.error || !conversation.data) {
        setError(conversation.error ?? "Conversation indisponible.");
        setStep("dicter");
        return;
      }

      const response = await askAssistant({
        conversation_id: conversation.data.id,
        message,
        input_mode: "ia_voix",
      });

      if (response.error || !response.data) {
        setError(response.error ?? "L'assistant n'a pas pu répondre.");
        setStep("dicter");
        return;
      }

      setResult(response.data);
      setStep(
        response.data.proposedActions.length > 0 ? "confirmer" : "resume"
      );
    });
  }

  function confirm() {
    if (!result || result.proposedActions.length === 0) return;
    setError(null);

    startTransition(async () => {
      const conversation = await getOrCreateGlobalConversation();
      if (conversation.error || !conversation.data) {
        setError(conversation.error ?? "Conversation indisponible.");
        return;
      }

      const response = await confirmAiActions({
        request_id: result.requestId,
        conversation_id: conversation.data.id,
        actions: result.proposedActions.map((action) => ({
          name: action.name,
          arguments: action.arguments,
        })),
      });

      if (response.error || !response.data) {
        setError(response.error ?? "Exécution impossible.");
        return;
      }

      setExecuted(response.data.executed);
      setStep("resume");
      router.refresh();
    });
  }

  function cancel() {
    if (result) {
      startTransition(async () => {
        await cancelAiActions(result.requestId);
      });
    }
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Parler à MAW
          </DialogTitle>
          <DialogDescription>
            {step === "dicter"
              ? "Parlez librement, même en désordre : plusieurs actions peuvent être extraites d'une seule dictée."
              : step === "analyse"
                ? "Analyse en cours…"
                : step === "confirmer"
                  ? "Rien n'est encore enregistré. Vérifiez, puis confirmez."
                  : "Voilà ce qui a été fait."}
          </DialogDescription>
        </DialogHeader>

        {step === "dicter" ? (
          <div className="flex flex-col gap-3">
            <VoiceRecorder
              label="Appuyer et parler"
              disabled={isPending}
              onError={(message) => {
                setError(message);
                setNotice(null);
              }}
              onTranscribed={({ text: transcribed, costLabel }) => {
                setError(null);
                setText((prev) =>
                  prev.trim() ? `${prev.trim()} ${transcribed}` : transcribed
                );
                setNotice(
                  `Transcription ajoutée${costLabel ? ` (${costLabel})` : ""} — corrigez-la si besoin.`
                );
              }}
            />

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="…ou écrivez directement ici."
              aria-label="Votre demande"
            />

            {notice ? (
              <p className="text-xs text-muted-foreground">{notice}</p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              onClick={analyse}
              disabled={isPending || text.trim() === ""}
              className="w-full"
            >
              <ArrowRight aria-hidden />
              Analyser
            </Button>
          </div>
        ) : null}

        {step === "analyse" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            MAW lit vos données et prépare les actions…
          </div>
        ) : null}

        {step === "confirmer" && result ? (
          <div className="flex flex-col gap-3">
            {result.message ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {result.message}
              </p>
            ) : null}

            <ul className="flex flex-col gap-1.5">
              {result.proposedActions.map((action, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {action.description}
                </li>
              ))}
            </ul>

            {result.issues.length > 0 ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p className="font-medium">Points à vérifier</p>
                <ul className="list-inside list-disc">
                  {result.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={isPending} className="flex-1">
                {isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Check aria-hidden />
                )}
                Confirmer {result.proposedActions.length} action
                {result.proposedActions.length > 1 ? "s" : ""}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("dicter")}
                disabled={isPending}
              >
                <Pencil aria-hidden />
                Modifier
              </Button>
              <Button variant="ghost" onClick={cancel} disabled={isPending}>
                <X aria-hidden />
                Annuler
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Coût de l&apos;analyse : {formatUsd(result.costUsd)}
              {result.budget.creditUsd > 0
                ? ` · restant estimé : ${formatUsd(result.budget.remainingUsd)}`
                : ""}
            </p>
          </div>
        ) : null}

        {step === "resume" ? (
          <div className="flex flex-col gap-3">
            {executed.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {executed.length} action{executed.length > 1 ? "s" : ""}{" "}
                  enregistrée{executed.length > 1 ? "s" : ""}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {executed.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                    >
                      {item.description}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {result?.message ?? "Aucune action à enregistrer."}
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={reset} className="flex-1">
                Autre demande
              </Button>
              <Button variant="outline" onClick={() => close(false)}>
                Fermer
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
