"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  askAssistant,
  cancelAiActions,
  confirmAiActions,
  type AskResult,
} from "@/actions/ai";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/lib/ai/pricing";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

const EXAMPLES = [
  "Ajoute pour Trust Industrie : optimiser la fiche Bureau Alcôve, priorité urgente, pour vendredi.",
  "J'ai terminé les trois fiches produits et j'ai travaillé deux heures.",
  "Montre-moi tout ce qui est en retard.",
  "Quelles prestations supplémentaires dois-je facturer ?",
];

export function AssistantChat({
  conversationId,
  initialMessages,
  isConfigured,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  isConfigured: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState<AskResult | null>(null);
  // Toujours renseigné après une réponse, même sans action proposée.
  const [lastResult, setLastResult] = React.useState<AskResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, startSending] = React.useTransition();
  const [isExecuting, startExecuting] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setError(null);
    setPending(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: trimmed },
    ]);

    startSending(async () => {
      const result = await askAssistant({
        conversation_id: conversationId,
        message: trimmed,
        input_mode: "ia_texte",
      });

      if (result.error || !result.data) {
        setError(result.error ?? "Réponse indisponible.");
        return;
      }

      setLastResult(result.data);

      if (result.data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${result.data.requestId}`,
            role: "assistant",
            content: result.data.message,
          },
        ]);
      }
      if (result.data.proposedActions.length > 0 || result.data.issues.length > 0) {
        setPending(result.data);
      }
      router.refresh();
    });
  }

  function confirm() {
    if (!pending) return;
    setError(null);
    startExecuting(async () => {
      const result = await confirmAiActions({
        request_id: pending.requestId,
        conversation_id: conversationId,
        actions: pending.proposedActions.map((a) => ({
          name: a.name,
          arguments: a.arguments,
        })),
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Exécution impossible.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${pending.requestId}`,
          role: "system",
          content:
            "Actions exécutées :\n" +
            result.data.executed.map((e) => `- ${e.description}`).join("\n"),
        },
      ]);
      setPending(null);
      router.refresh();
    });
  }

  function cancel() {
    if (!pending) return;
    startExecuting(async () => {
      await cancelAiActions(pending.requestId);
      setPending(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {lastResult ? (
        <p className="text-xs text-muted-foreground">
          Coût de la dernière demande :{" "}
          <strong className="text-foreground">
            {formatUsd(lastResult.costUsd)}
          </strong>{" "}
          · ce mois-ci : {formatUsd(lastResult.budget.spentThisMonthUsd)}
          {lastResult.budget.creditUsd > 0 ? (
            <>
              {" "}
              · restant estimé :{" "}
              <strong
                className={
                  lastResult.budget.isLow
                    ? "text-destructive"
                    : "text-foreground"
                }
              >
                {formatUsd(lastResult.budget.remainingUsd)}
              </strong>
            </>
          ) : null}
        </p>
      ) : null}

      {!isConfigured ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              Assistant non configuré
            </CardTitle>
            <CardDescription>
              Ajoutez votre clé <code>OPENAI_API_KEY</code> dans le fichier
              <code> .env.local</code> puis relancez l&apos;application. La clé
              reste côté serveur : elle n&apos;est jamais envoyée au navigateur.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="flex min-h-64 flex-col gap-3">
        {messages.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Parlez-lui normalement
              </CardTitle>
              <CardDescription>
                L&apos;assistant lit vos données, propose des actions, et
                n&apos;exécute rien sans votre confirmation.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  disabled={!isConfigured || isSending}
                  className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  « {example} »
                </button>
              ))}
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role !== "user" ? (
                <span
                  className={cn(
                    "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full",
                    message.role === "system"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {message.role === "system" ? (
                    <ShieldCheck className="size-4" aria-hidden />
                  ) : (
                    <Bot className="size-4" aria-hidden />
                  )}
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.role === "system"
                      ? "bg-emerald-50 text-emerald-900"
                      : "bg-card border"
                )}
              >
                {message.content}
              </div>
              {message.role === "user" ? (
                <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <UserRound className="size-4" aria-hidden />
                </span>
              ) : null}
            </div>
          ))
        )}

        {isSending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            L&apos;assistant réfléchit…
          </div>
        ) : null}

        {pending && pending.proposedActions.length > 0 ? (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">
                Actions proposées — à confirmer
              </CardTitle>
              <CardDescription>
                Rien n&apos;a été enregistré pour l&apos;instant. Vérifiez puis
                confirmez : tout sera exécuté d&apos;un bloc, ou rien.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                {pending.proposedActions.map((action, index) => (
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
              <div className="flex gap-2">
                <Button onClick={confirm} disabled={isExecuting}>
                  {isExecuting ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Check aria-hidden />
                  )}
                  Confirmer
                </Button>
                <Button
                  variant="outline"
                  onClick={cancel}
                  disabled={isExecuting}
                >
                  <X aria-hidden />
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {pending && pending.issues.length > 0 ? (
          <Card className="border-destructive/40">
            <CardContent className="py-3 text-sm">
              <p className="mb-1 font-medium text-destructive">
                Points à vérifier
              </p>
              <ul className="list-inside list-disc text-muted-foreground">
                {pending.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t bg-background pt-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Écrivez votre demande…"
          rows={2}
          disabled={!isConfigured || isSending}
          aria-label="Message pour l'assistant"
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!isConfigured || isSending || input.trim() === ""}
          aria-label="Envoyer"
          className="self-end"
        >
          {isSending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
        </Button>
      </form>
    </div>
  );
}
