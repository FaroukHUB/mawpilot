import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmailFallback, type EmailResult } from "@/lib/notifications/email";
import { sendPushToUser } from "@/lib/notifications/push";

/**
 * Envoi d'une notification personnelle sur tous les canaux disponibles.
 *
 * Ordre : trace interne (toujours), puis push (application fermée), puis
 * **email de secours uniquement si le push n'a atteint aucun appareil**.
 * Objectif : être prévenu même téléphone rangé, sans recevoir deux fois la
 * même alerte.
 */

export type NotifyInput = {
  title: string;
  body: string;
  url?: string;
  /** Force l'email même si le push a réussi (alertes critiques). */
  alwaysEmail?: boolean;
};

export type NotifyResult = {
  notificationId: string | null;
  push: { sent: number; failed: number; configured: boolean };
  email: EmailResult;
};

export async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  input: NotifyInput
): Promise<NotifyResult> {
  const push = await sendPushToUser(supabase, userId, {
    title: input.title,
    body: input.body,
    url: input.url,
  });

  const needsEmail = input.alwaysEmail === true || push.sent === 0;
  const email: EmailResult = needsEmail
    ? await sendEmailFallback({
        subject: input.title,
        body: input.body,
        url: input.url,
      })
    : "non_configure";

  const delivery = {
    push: push.configured
      ? push.sent > 0
        ? `envoye (${push.sent})`
        : "aucun_appareil"
      : "non_configure",
    email: needsEmail ? email : "non_necessaire",
  };

  const { data } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      delivery,
    })
    .select("id")
    .single();

  return { notificationId: data?.id ?? null, push, email };
}
