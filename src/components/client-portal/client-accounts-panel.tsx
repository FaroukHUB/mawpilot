"use client";

import * as React from "react";
import { KeyRound, Loader2, Power, PowerOff, UserPlus } from "lucide-react";

import {
  linkClientAccount,
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
 * Gestion des comptes clients : vous créez le compte dans Supabase, puis
 * vous le rattachez ici. Le client se connecte ensuite normalement.
 */
export function ClientAccountsPanel({
  companyId,
  accounts,
  contacts,
}: {
  companyId: string;
  accounts: ClientAccountRow[];
  contacts: { id: string; name: string }[];
}) {
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const list = Array.isArray(accounts) ? accounts : [];

  function link() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await linkClientAccount({
        company_id: companyId,
        email,
        display_name: displayName || email.split("@")[0],
        contact_id: contactId,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(
        `Accès activé. ${email} peut maintenant se connecter et arrivera dans son espace.`
      );
      setEmail("");
      setDisplayName("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden />
          Comptes clients ({list.filter((a) => a.is_active).length})
        </CardTitle>
        <CardDescription>
          Créez d&apos;abord le compte dans Supabase (Authentication → Users →
          Add user), puis rattachez-le ici. Votre client se connecte ensuite
          sur la page d&apos;accueil, comme vous.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-email">Email du compte Supabase</Label>
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

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {success}
            </p>
          ) : null}

          <Button
            onClick={link}
            disabled={isPending || email.trim() === ""}
            className="self-start"
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <UserPlus aria-hidden />
            )}
            Activer l&apos;accès
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
