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
  // Permet un déploiement Docker autonome (Cloudflare, Render, VPS…)
  // sans rien changer au code. Voir README, section Déploiement.
  output: "standalone",

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
