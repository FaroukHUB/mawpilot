import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les réponses.
 * L'application est privée : on verrouille par défaut.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Le micro reste autorisé (dictée) ; le reste est refusé.
    value: "camera=(), geolocation=(), interest-cohort=(), microphone=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Sortie autonome pour Docker (Cloudflare, Render, VPS…) — voir README.
  // Sur Vercel, ce mode n'a pas lieu d'être : la plateforme construit
  // Next.js nativement et son étape finale échoue si on le force.
  // `process.env.VERCEL` vaut "1" pendant un build Vercel.
  output: process.env.VERCEL ? undefined : "standalone",

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Le service worker ne doit jamais être servi depuis un cache figé.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
