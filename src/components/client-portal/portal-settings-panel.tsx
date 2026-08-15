"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  createPortalLink,
  revokePortalLink,
  savePortalSettings,
} from "@/actions/client-access";
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
import { formatDateShort } from "@/lib/dates";

export type PortalTokenRow = {
  id: string;
  label: string;
  token_prefix: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  use_count: number;
};

export type PortalSettingsRow = {
  company_id: string;
  is_enabled: boolean;
  welcome_message: string | null;
  included_scope: string | null;
  excluded_scope: string | null;
  monthly_request_quota: number;
  out_of_scope_message: string;
  quota_reached_message: string;
  tone: string;
  ai_reply_enabled: boolean;
  voice_enabled: boolean;
  show_completed: boolean;
  show_in_progress: boolean;
  show_waiting_client: boolean;
  show_upcoming: boolean;
  show_documents: boolean;
  show_reports: boolean;
  show_metrics: boolean;
};

const DEFAULTS = {
  out_of_scope_message:
    "Cette demande sort des prestations incluses dans votre forfait. Je la transmets pour étude, vous recevrez une proposition rapidement.",
  quota_reached_message:
    "Vous avez atteint le nombre de demandes incluses ce mois-ci. Votre demande est enregistrée et sera étudiée en priorité.",
  tone: "professionnel et chaleureux",
};

export function PortalSettingsPanel({
  companyId,
  companyName,
  tokens,
  settings,
  contacts,
}: {
  companyId: string;
  companyName: string;
  tokens: PortalTokenRow[];
  settings: PortalSettingsRow | null;
  contacts: { id: string; name: string }[];
}) {
  const [newLink, setNewLink] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const [form, setForm] = React.useState({
    included_scope: settings?.included_scope ?? "",
    excluded_scope: settings?.excluded_scope ?? "",
    welcome_message: settings?.welcome_message ?? "",
    monthly_request_quota: String(settings?.monthly_request_quota ?? 0),
    out_of_scope_message:
      settings?.out_of_scope_message ?? DEFAULTS.out_of_scope_message,
    quota_reached_message:
      settings?.quota_reached_message ?? DEFAULTS.quota_reached_message,
    tone: settings?.tone ?? DEFAULTS.tone,
    ai_reply_enabled: settings?.ai_reply_enabled ?? true,
    voice_enabled: settings?.voice_enabled ?? true,
    show_completed: settings?.show_completed ?? true,
    show_in_progress: settings?.show_in_progress ?? true,
    show_waiting_client: settings?.show_waiting_client ?? true,
    show_upcoming: settings?.show_upcoming ?? true,
    show_documents: settings?.show_documents ?? true,
    show_reports: settings?.show_reports ?? true,
    show_metrics: settings?.show_metrics ?? true,
  });

  const activeTokens = (Array.isArray(tokens) ? tokens : []).filter(
    (t) => !t.revoked_at
  );

  function create() {
    setError(null);
    setNewLink(null);
    startTransition(async () => {
      const result = await createPortalLink({
        company_id: companyId,
        contact_id: contactId,
        label: label.trim() || `Lien ${companyName}`,
        expires_in_days: 180,
      });
      if (result.error || !result.data) {
        setError(result.error ?? "Création impossible.");
        return;
      }
      setNewLink(result.data.url);
      setLabel("");
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await savePortalSettings({
        company_id: companyId,
        is_enabled: true,
        ...form,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const visibilityFields: { key: keyof typeof form; label: string }[] = [
    { key: "show_completed", label: "Travail réalisé" },
    { key: "show_in_progress", label: "En cours" },
    { key: "show_waiting_client", label: "En attente de sa réponse" },
    { key: "show_upcoming", label: "Échéances à venir" },
    { key: "show_documents", label: "Livrables partagés" },
    { key: "show_reports", label: "Comptes rendus partagés" },
    { key: "show_metrics", label: "Résultats et indicateurs" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" aria-hidden />
            Liens d&apos;accès ({activeTokens.length})
          </CardTitle>
          <CardDescription>
            Chaque contact reçoit un lien personnel, révocable à tout moment.
            Aucun compte à créer de son côté.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {newLink ? (
            <div className="flex flex-col gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <ShieldCheck className="size-4" aria-hidden />
                Lien créé — copiez-le maintenant
              </p>
              <p className="text-xs text-emerald-900">
                Il ne sera plus jamais affiché : il n&apos;est pas stocké en
                clair.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={newLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(newLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
            </div>
          ) : null}

          {activeTokens.map((token) => (
            <div
              key={token.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{token.label}</p>
                <p className="text-xs text-muted-foreground">
                  {token.use_count} ouverture{token.use_count > 1 ? "s" : ""}
                  {token.last_used_at
                    ? ` · dernière le ${formatDateShort(token.last_used_at)}`
                    : " · jamais ouvert"}
                  {token.expires_at
                    ? ` · expire le ${formatDateShort(token.expires_at)}`
                    : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Révoquer ${token.label}`}
                className="text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Révoquer « ${token.label} » ? Le lien cessera immédiatement de fonctionner.`
                    )
                  ) {
                    return;
                  }
                  startTransition(async () => {
                    await revokePortalLink(token.id);
                  });
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-40 flex-1 flex-col gap-2">
              <Label htmlFor="token-label">Nom du lien</Label>
              <Input
                id="token-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Olivier — direction"
              />
            </div>
            {contacts.length > 0 ? (
              <div className="flex min-w-40 flex-1 flex-col gap-2">
                <Label htmlFor="token-contact">Contact</Label>
                <select
                  id="token-contact"
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
            <Button onClick={create} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Link2 aria-hidden />
              )}
              Créer un lien
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Charte du portail</CardTitle>
          <CardDescription>
            C&apos;est ce qui permet à l&apos;assistant de reconnaître une
            demande hors forfait — et de répondre avec <strong>vos</strong>{" "}
            mots, jamais les siens.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="included">Prestations incluses</Label>
              <Textarea
                id="included"
                rows={4}
                value={form.included_scope}
                onChange={(e) =>
                  setForm({ ...form, included_scope: e.target.value })
                }
                placeholder="Mise à jour du contenu, corrections mineures, suivi SEO mensuel…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="excluded">Hors forfait</Label>
              <Textarea
                id="excluded"
                rows={4}
                value={form.excluded_scope}
                onChange={(e) =>
                  setForm({ ...form, excluded_scope: e.target.value })
                }
                placeholder="Refonte graphique, nouvelles fonctionnalités, campagnes publicitaires…"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quota">
                Demandes incluses par mois (0 = illimité)
              </Label>
              <Input
                id="quota"
                type="number"
                min="0"
                value={form.monthly_request_quota}
                onChange={(e) =>
                  setForm({ ...form, monthly_request_quota: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tone">Ton des réponses</Label>
              <Input
                id="tone"
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="out-of-scope">
              Phrase exacte pour une demande hors forfait
            </Label>
            <Textarea
              id="out-of-scope"
              rows={2}
              value={form.out_of_scope_message}
              onChange={(e) =>
                setForm({ ...form, out_of_scope_message: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              L&apos;assistant l&apos;utilise mot pour mot, sans la reformuler.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quota-message">Phrase quand le quota est atteint</Label>
            <Textarea
              id="quota-message"
              rows={2}
              value={form.quota_reached_message}
              onChange={(e) =>
                setForm({ ...form, quota_reached_message: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="welcome">Message d&apos;accueil</Label>
            <Input
              id="welcome"
              value={form.welcome_message}
              onChange={(e) =>
                setForm({ ...form, welcome_message: e.target.value })
              }
              placeholder="Bonjour, voici l'avancement de votre projet."
            />
          </div>

          <fieldset className="flex flex-col gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">
              Ce que le client voit
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {visibilityFields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--brand-orange)]"
                    checked={Boolean(form[field.key])}
                    onChange={(e) =>
                      setForm({ ...form, [field.key]: e.target.checked })
                    }
                  />
                  {field.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Ne sont jamais visibles : votre temps passé, les montants, vos
              notes internes, la mémoire IA et vos accès rapides.
            </p>
          </fieldset>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand-orange)]"
                checked={form.ai_reply_enabled}
                onChange={(e) =>
                  setForm({ ...form, ai_reply_enabled: e.target.checked })
                }
              />
              L&apos;assistant répond directement au client
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand-orange)]"
                checked={form.voice_enabled}
                onChange={(e) =>
                  setForm({ ...form, voice_enabled: e.target.checked })
                }
              />
              Le client peut dicter ses demandes
            </label>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={isPending}>
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Enregistrer la charte
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                <Check className="size-4" aria-hidden />
                Enregistré
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
