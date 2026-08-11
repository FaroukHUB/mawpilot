import { z } from "zod";

export const RESOURCE_CATEGORIES = [
  "site_public",
  "administration_site",
  "hebergement",
  "domaine_dns",
  "github",
  "vercel",
  "supabase",
  "shopify",
  "wordpress",
  "search_console",
  "google_analytics",
  "google_tag_manager",
  "google_business_profile",
  "google_ads",
  "metricool",
  "meta_business_suite",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "canva",
  "stockage_documents",
  "autre",
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const resourceCategoryLabels: Record<ResourceCategory, string> = {
  site_public: "Site public",
  administration_site: "Administration du site",
  hebergement: "Hébergement",
  domaine_dns: "Domaine / DNS",
  github: "GitHub",
  vercel: "Vercel",
  supabase: "Supabase",
  shopify: "Shopify",
  wordpress: "WordPress",
  search_console: "Search Console",
  google_analytics: "Google Analytics 4",
  google_tag_manager: "Google Tag Manager",
  google_business_profile: "Google Business Profile",
  google_ads: "Google Ads",
  metricool: "Metricool",
  meta_business_suite: "Meta Business Suite",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  canva: "Canva",
  stockage_documents: "Stockage de documents",
  autre: "Autre",
};

/** Regroupement pour l'affichage par familles. */
export const resourceGroups: { label: string; categories: ResourceCategory[] }[] =
  [
    {
      label: "Site & technique",
      categories: [
        "site_public",
        "administration_site",
        "wordpress",
        "shopify",
        "hebergement",
        "domaine_dns",
        "github",
        "vercel",
        "supabase",
      ],
    },
    {
      label: "Mesure & référencement",
      categories: [
        "search_console",
        "google_analytics",
        "google_tag_manager",
        "google_business_profile",
        "google_ads",
        "metricool",
      ],
    },
    {
      label: "Réseaux sociaux",
      categories: [
        "meta_business_suite",
        "facebook",
        "instagram",
        "linkedin",
        "tiktok",
        "youtube",
      ],
    },
    {
      label: "Contenus & documents",
      categories: ["canva", "stockage_documents", "autre"],
    },
  ];

const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/**
 * Motifs de secrets refusés : cette table ne doit jamais contenir de mot de
 * passe, clé API, code de récupération ou jeton (règle non négociable).
 */
const SECRET_PATTERNS =
  /(mot\s*de\s*passe|password|passwd|\bpwd\b|clé\s*api|api[_\s-]?key|secret|token|jeton|code\s*(de\s*)?(récupération|recuperation|secours)|2fa|otp)/i;

/** Champ texte facultatif qui refuse tout ce qui ressemble à un secret. */
const optionalTextNoSecrets = (fieldLabel: string, max = 1000) =>
  optionalText(max).refine(
    (v) => typeof v !== "string" || !SECRET_PATTERNS.test(v),
    `${fieldLabel} : aucun mot de passe, clé API ou secret ne doit être enregistré ici. Utilisez un gestionnaire de mots de passe.`
  );

export const resourceSchema = z.object({
  company_id: z.uuid("Entreprise invalide."),
  category: z.enum(RESOURCE_CATEGORIES).default("autre"),
  label: z.string().trim().min(1, "Le libellé est requis.").max(200),
  url: z.url("URL invalide (inclure https://)."),
  description: optionalTextNoSecrets("Description"),
  access_notes: optionalTextNoSecrets("Notes d'accès"),
  login_hint: optionalTextNoSecrets("Identifiant", 200),
  password_manager_ref: optionalText(200),
  is_favorite: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type ResourceInput = z.infer<typeof resourceSchema>;
