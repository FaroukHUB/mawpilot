import Link from "next/link";
import { AlertTriangle, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, type BudgetState } from "@/lib/ai/pricing";
import { cn } from "@/lib/utils";

/**
 * Compteur de consommation de l'assistant.
 * Le crédit restant est une estimation : l'API OpenAI n'expose pas le solde
 * du compte, c'est donc le crédit déclaré moins la consommation mesurée.
 */
export function BudgetMeter({
  budget,
  lastCostUsd,
}: {
  budget: BudgetState;
  lastCostUsd?: number;
}) {
  const hasCredit = budget.creditUsd > 0;
  const usedRatio = hasCredit
    ? Math.min(1, budget.spentSinceCreditUsd / budget.creditUsd)
    : 0;

  return (
    <Card
      className={cn(
        "gap-2 py-3",
        budget.isExhausted
          ? "border-destructive"
          : budget.isLow
            ? "border-brand-orange"
            : undefined
      )}
    >
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Wallet className="size-4 text-muted-foreground" aria-hidden />
            Budget assistant
          </span>
          {lastCostUsd !== undefined ? (
            <span className="text-muted-foreground">
              Dernière demande :{" "}
              <strong className="text-foreground">
                {formatUsd(lastCostUsd)}
              </strong>
            </span>
          ) : null}
          <span className="text-muted-foreground">
            Ce mois-ci :{" "}
            <strong className="text-foreground">
              {formatUsd(budget.spentThisMonthUsd)}
            </strong>
          </span>
          {hasCredit ? (
            <span className="text-muted-foreground">
              Restant estimé :{" "}
              <strong
                className={cn(
                  budget.isExhausted
                    ? "text-destructive"
                    : budget.isLow
                      ? "text-orange-700"
                      : "text-foreground"
                )}
              >
                {formatUsd(budget.remainingUsd)}
              </strong>{" "}
              sur {formatUsd(budget.creditUsd)}
            </span>
          ) : (
            <Link
              href="/parametres"
              className="text-primary underline-offset-4 hover:underline"
            >
              Déclarez votre crédit pour suivre le restant →
            </Link>
          )}
        </div>

        {hasCredit ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(usedRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Crédit consommé"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                budget.isExhausted
                  ? "bg-destructive"
                  : budget.isLow
                    ? "bg-brand-orange"
                    : "bg-primary"
              )}
              style={{ width: `${usedRatio * 100}%` }}
            />
          </div>
        ) : null}

        {budget.isLow ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {budget.isExhausted
                ? "Crédit épuisé d'après votre compteur : l'assistant est mis en pause."
                : `Il reste moins de ${formatUsd(budget.alertThresholdUsd)} de crédit estimé.`}{" "}
              Rechargez votre compte OpenAI, puis mettez le montant à jour dans{" "}
              <Link href="/parametres" className="underline">
                Paramètres
              </Link>
              .
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
