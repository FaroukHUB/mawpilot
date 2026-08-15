"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import {
  createClientAccount,
  resetClientPassword,
  setClientAccountActive,
} from "@/actions/client-accounts";
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
import { formatDateShort } from "@/lib/dates";

export type ClientAccountRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

/**
 * Création et gestion des accès clients.
 * Le compte Supabase est créé par l'application : rien à faire ailleurs.
 */
export function ClientAccountsPanel({
  companyId,
  companyName,
  accounts,
  contacts,
  setupMessage,
  appUrl,
}: {
  companyId: string;
  companyName: string;
  accounts: ClientAccountRow[];
  contacts: { id: string; name: string }[];
  setupMessage: string | null;
  appUrl: string;
}) {
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [credentials, setCredentials] = React.useState<{
    email: string;
    password: string | null;
    created: boolean;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const list = Array.isArray(accounts) ? accounts : [];

  function create() {
    setError(null);
    setCredentials(null);
    startTransition(async () => {
      const result = await createClientAccount({
        company_id: companyId,
        email,
        display_name: displayName || email.split("@")[0],
        password,
        contact_id: contactId,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Création impossible.");
        return;
      }
      setCredentials({
        email: result.data.email,
        password: result.data.password,
        created: result.data.created,
      });
      setEmail("");
      setDisplayName("");
      setPassword("");
    });
  }

  const invitation = credentials
    ? `Bonjour,\n\nVoici votre espace de suivi ${companyName} :\n${appUrl}\n\nIdentifiant : ${credentials.email}${
        credentials.password ? `\nMot de passe : ${credentials.password}` : ""
      }\n\nVous y verrez l'avancement en temps réel et pourrez y déposer vos demandes, à l'écrit ou en vocal.`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden />
          Accès clients ({list.filter((a) => a.is_active).length})
        </CardTitle>
        <CardDescription>
          Créez le compte de votre client ici : il pourra se connecter sur la
          page d&apos;accueil et arrivera directement dans son espace. Aucune
          inscription libre n&apos;est possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {setupMessage ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {setupMessage}
          </p>
        ) : null}

        {list.map((account) => (
          <div
            key={account.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
              account.is_active ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{account.display_name}</p>
              <p className="text-xs text-muted-foreground">
                Créé le {formatDateShort(account.created_at)}
                {account.last_seen_at
                  ? ` · dernière visite le ${formatDateShort(account.last_seen_at)}`
                  : " · jamais connecté"}
              </p>
            </div>
            {!account.is_active ? (
              <Badge variant="secondary">Suspendu</Badge>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resetClientPassword(account.id);
                  if (result.error || !result.data) {
                    setError(result.error ?? "Réinitialisation impossible.");
                    return;
                  }
                  setCredentials({
                    email: result.data.email,
                    password: result.data.password,
                    created: false,
                  });
                })
              }
            >
              <RefreshCw aria-hidden />
              Nouveau mot de passe
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={
                account.is_active
                  ? `Suspendre l'accès de ${account.display_name}`
                  : `Réactiver l'accès de ${account.display_name}`
              }
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await setClientAccountActive(account.id, !account.is_active);
                })
              }
            >
              {account.is_active ? (
                <Power aria-hidden />
              ) : (
                <PowerOff aria-hidden />
              )}
            </Button>
          </div>
        ))}

        {credentials ? (
          <div className="flex flex-col gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-sm font-medium text-emerald-900">
              {credentials.created
                ? "Compte créé — transmettez ces identifiants"
                : credentials.password
                  ? "Nouveau mot de passe — transmettez-le"
                  : "Compte existant rattaché à cette entreprise"}
            </p>
            {credentials.password ? (
              <>
                <p className="text-xs text-emerald-900">
                  Le mot de passe n&apos;est affiché qu&apos;une fois. Vous
                  pourrez toujours en générer un nouveau.
                </p>
                <textarea
                  readOnly
                  value={invitation}
                  rows={7}
                  className="w-full rounded-md border bg-white p-2 font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  size="sm"
                  className="self-start"
                  onClick={async () => {
                    await navigator.clipboard.writeText(invitation);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Message copié" : "Copier le message d'invitation"}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-email">Email du client *</Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="olivier@collection-originale.fr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-name">Nom affiché</Label>
              <Input
                id="account-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Olivier Martin"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-password">Mot de passe</Label>
              <Input
                id="account-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Laisser vide pour en générer un"
              />
            </div>
            {contacts.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-contact">Contact associé</Label>
                <select
                  id="account-contact"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Aucun —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            onClick={create}
            disabled={isPending || email.trim() === ""}
            className="self-start"
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <UserPlus aria-hidden />
            )}
            Créer l&apos;accès
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
