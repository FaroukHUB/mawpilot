import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BudgetForm } from "@/components/settings/budget-form";
import { ProfileForm } from "@/components/settings/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadBudgetState } from "@/lib/ai/budget";
import { formatUsd } from "@/lib/ai/pricing";
import { formatDateShort } from "@/lib/dates";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const budget = await loadBudgetState(supabase, user.id);

  const [{ data: profile }, { data: recentRequests }] = await Promise.all([
    supabase.from("profiles").select("full_name, timezone").single(),
    supabase
      .from("ai_requests")
      .select("id, user_message, cost_usd, input_tokens, output_tokens, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Connecté en tant que {user.email ?? "—"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              full_name: profile?.full_name ?? "",
              timezone: profile?.timezone ?? "Europe/Paris",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget de l&apos;assistant</CardTitle>
          <CardDescription>
            L&apos;API OpenAI ne permet pas de lire le solde de votre compte :
            indiquez le crédit rechargé, l&apos;application en déduit la
            consommation qu&apos;elle mesure réellement. L&apos;assistant se met
            en pause si le crédit estimé tombe à zéro.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ce mois-ci" value={formatUsd(budget.spentThisMonthUsd)} />
            <Stat
              label="Depuis le rechargement"
              value={formatUsd(budget.spentSinceCreditUsd)}
            />
            <Stat label="Crédit déclaré" value={formatUsd(budget.creditUsd)} />
            <Stat
              label="Restant estimé"
              value={budget.creditUsd > 0 ? formatUsd(budget.remainingUsd) : "—"}
              highlight={budget.isLow}
            />
          </div>

          <BudgetForm
            spentSinceCreditUsd={budget.spentSinceCreditUsd}
            defaultValues={{
              credit_usd: String(budget.settings.creditUsd),
              alert_threshold_usd: String(budget.settings.alertThresholdUsd),
              price_input_per_million: String(
                budget.settings.rates.inputPerMillion
              ),
              price_cached_input_per_million: String(
                budget.settings.rates.cachedInputPerMillion
              ),
              price_output_per_million: String(
                budget.settings.rates.outputPerMillion
              ),
              reset_counter: false,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dernières demandes à l&apos;assistant</CardTitle>
          <CardDescription>
            Coût réel de chaque demande, tous allers-retours compris.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(recentRequests ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune demande enregistrée pour l&apos;instant.
            </p>
          ) : (
            (recentRequests ?? []).map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{request.user_message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(request.created_at)} ·{" "}
                    {request.input_tokens} jetons entrée ·{" "}
                    {request.output_tokens} sortie
                  </p>
                </div>
                <span className="shrink-0 font-medium">
                  {formatUsd(Number(request.cost_usd ?? 0))}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p
        className={`text-lg font-semibold ${highlight ? "text-destructive" : ""}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
