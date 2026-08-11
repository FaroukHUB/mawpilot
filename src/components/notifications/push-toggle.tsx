"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Convertit la clé VAPID (base64url) au format attendu par le navigateur. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "inconnu" | "indisponible" | "refuse" | "actif" | "inactif";

/**
 * Active les notifications push sur cet appareil.
 * C'est ce qui permet d'être prévenu application fermée.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = React.useState<State>("inconnu");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;

    async function detect(): Promise<State> {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return "indisponible";
      }
      if (Notification.permission === "denied") return "refuse";

      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (!registration) return "indisponible";

      const subscription = await registration.pushManager.getSubscription();
      return subscription ? "actif" : "inactif";
    }

    detect().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      try {
        if (!publicKey) {
          setError(
            "Notifications push non configurées côté serveur (clés VAPID absentes)."
          );
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("refuse");
          setError(
            "Notifications refusées. Autorisez-les dans les réglages du navigateur."
          );
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setError(payload.error ?? "Enregistrement de l'appareil impossible.");
          return;
        }
        setState("actif");
      } catch {
        setError("Activation impossible sur cet appareil.");
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(
          `/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { method: "DELETE" }
        );
        await subscription.unsubscribe();
      }
      setState("inactif");
    });
  }

  if (state === "inconnu") return null;

  if (state === "indisponible") {
    return (
      <p className="text-sm text-muted-foreground">
        Cet appareil ne gère pas les notifications push. Sur iPhone, installez
        d&apos;abord l&apos;application sur l&apos;écran d&apos;accueil.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "actif" ? (
          <Button variant="outline" onClick={disable} disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <BellOff aria-hidden />
            )}
            Désactiver sur cet appareil
          </Button>
        ) : (
          <Button onClick={enable} disabled={isPending || state === "refuse"}>
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Bell aria-hidden />
            )}
            Activer les notifications
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {state === "actif"
            ? "Vous serez prévenu même application fermée."
            : state === "refuse"
              ? "Notifications bloquées par le navigateur."
              : "Recevez les rappels sans ouvrir l'application."}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
