import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notifications push (Web Push / PWA).
 *
 * Fonctionne application fermée, y compris sur iPhone à condition que la PWA
 * soit installée sur l'écran d'accueil. Les clés VAPID sont générées une fois
 * par `npm run generate:vapid` ; la clé privée reste côté serveur.
 */

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configure(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

type Subscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Envoie une notification à tous les appareils de l'utilisateur.
 * Un abonnement expiré (404/410) est supprimé : un téléphone réinitialisé ne
 * doit pas faire échouer les envois suivants.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; configured: boolean }> {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, configured: false };
  }

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  const subscriptions = (data ?? []) as Subscription[];
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, configured: true };
  }

  configure();
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body
        );
        sent++;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expired.push(subscription.id);
        } else {
          failed++;
          console.error("Échec d'envoi push :", error);
        }
      }
    })
  );

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }

  if (sent > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_success_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return { sent, failed, configured: true };
}
