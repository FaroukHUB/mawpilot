/**
 * Utilitaires WhatsApp — partage assisté manuel uniquement.
 *
 * Rappels de conception (règles non négociables) :
 * - un lien direct n'est produit que pour un numéro international valide ;
 * - un nom de groupe ne permet JAMAIS de cibler automatiquement un groupe :
 *   il sert d'aide-mémoire, l'utilisateur sélectionne lui-même la destination ;
 * - aucun envoi automatique, aucun rapport marqué « envoyé » sans confirmation.
 */

/** Retire tout sauf les chiffres (et garde un éventuel + initial). */
export function normalizePhoneNumber(input: string): string {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Valide un numéro au format international E.164 : « + » suivi de
 * 8 à 15 chiffres, le premier ne pouvant pas être 0.
 */
export function isValidInternationalNumber(input: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(input));
}

/** Format lisible : +213 6 61 23 45 67 → groupes de 2 après l'indicatif. */
export function formatPhoneForDisplay(input: string): string {
  const n = normalizePhoneNumber(input);
  if (!isValidInternationalNumber(n)) return input;
  const digits = n.slice(1);
  return `+${digits.replace(/(\d{2,3})(?=\d)/g, "$1 ").trim()}`;
}

/**
 * Construit un lien wa.me pour un numéro international validé.
 * Retourne null si le numéro n'est pas exploitable — on n'invente jamais
 * un lien qui échouerait silencieusement.
 */
export function buildWhatsAppLink(
  phoneNumber: string,
  message?: string
): string | null {
  if (!isValidInternationalNumber(phoneNumber)) return null;
  const digits = normalizePhoneNumber(phoneNumber).slice(1);
  const base = `https://wa.me/${digits}`;
  return message && message.trim() !== ""
    ? `${base}?text=${encodeURIComponent(message)}`
    : base;
}
