import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Jetons d'accès au portail client.
 *
 * Le jeton complet n'existe que dans le lien envoyé au contact. La base ne
 * contient qu'un préfixe (pour retrouver la ligne) et un hachage SHA-256.
 * Conséquence : même avec un accès complet à la base, on ne peut pas
 * fabriquer un lien valide.
 */

const PREFIX_LENGTH = 12;
const SECRET_BYTES = 32;

export type GeneratedToken = {
  /** À placer dans le lien, une seule fois. Jamais stocké en clair. */
  fullToken: string;
  prefix: string;
  hash: string;
};

/** Base64 sans caractères ambigus ni encodage d'URL. */
function toUrlSafe(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function generateToken(): GeneratedToken {
  const prefix = toUrlSafe(randomBytes(9)).slice(0, PREFIX_LENGTH);
  const secret = toUrlSafe(randomBytes(SECRET_BYTES));
  const fullToken = `${prefix}.${secret}`;

  return { fullToken, prefix, hash: hashToken(fullToken) };
}

export function hashToken(fullToken: string): string {
  return createHash("sha256").update(fullToken).digest("hex");
}

/** Sépare le préfixe du jeton complet reçu dans l'URL. */
export function parseToken(
  fullToken: string
): { prefix: string; valid: boolean } {
  const parts = fullToken.split(".");
  if (parts.length !== 2 || parts[0].length !== PREFIX_LENGTH || !parts[1]) {
    return { prefix: "", valid: false };
  }
  return { prefix: parts[0], valid: true };
}

/** Comparaison à temps constant : la durée ne renseigne pas l'attaquant. */
export function verifyToken(fullToken: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(fullToken));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Lien complet à envoyer au contact. */
export function buildPortalUrl(fullToken: string, appUrl?: string): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(
    /\/$/,
    ""
  );
  return `${base}/client/${fullToken}`;
}
