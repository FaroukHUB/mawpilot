/**
 * Email de secours.
 *
 * Utilisé quand le push n'a atteint aucun appareil (aucun abonnement,
 * navigateur incompatible, notifications refusées). Envoi direct par HTTP :
 * aucune dépendance supplémentaire.
 *
 * Fournisseur : Resend (offre gratuite suffisante pour des notifications
 * personnelles). Si les variables ne sont pas configurées, l'envoi est
 * silencieusement ignoré — la notification reste visible dans l'application.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL);
}

export type EmailResult = "envoye" | "non_configure" | "echec";

export async function sendEmailFallback(input: {
  subject: string;
  body: string;
  url?: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) return "non_configure";

  const from =
    process.env.ALERT_EMAIL_FROM || "MAW Pilot by Farouk <onboarding@resend.dev>";
  const link = input.url
    ? `\n\nOuvrir : ${process.env.NEXT_PUBLIC_APP_URL ?? ""}${input.url}`
    : "";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [process.env.ALERT_EMAIL],
        subject: input.subject,
        text: `${input.body}${link}`,
      }),
    });

    if (!response.ok) {
      console.error("Échec d'envoi email :", await response.text());
      return "echec";
    }
    return "envoye";
  } catch (error) {
    console.error("Échec d'envoi email :", error);
    return "echec";
  }
}
