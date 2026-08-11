import { z } from "zod";

import {
  BILLING_STATUSES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/enums";
import { RESOURCE_CATEGORIES } from "@/lib/validations/resources";

/**
 * Fonctions que l'assistant peut choisir.
 *
 * Règles :
 * - l'IA n'a JAMAIS d'accès SQL : elle ne peut appeler que ces fonctions ;
 * - chaque argument est validé par Zod côté serveur avant toute exécution ;
 * - les fonctions de LECTURE s'exécutent immédiatement (pour répondre) ;
 * - les fonctions d'ÉCRITURE sont seulement proposées : elles ne s'exécutent
 *   qu'après confirmation explicite de l'utilisateur.
 */

const uuid = z.uuid();
const optionalString = z.string().optional();

// --- Lecture -----------------------------------------------------------

export const readSchemas = {
  search_tasks: z.object({
    company_id: uuid.optional(),
    query: optionalString,
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    billing_status: z.enum(BILLING_STATUSES).optional(),
    due_before: optionalString,
    due_after: optionalString,
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_company_summary: z.object({
    company_id: uuid,
    period_start: optionalString,
    period_end: optionalString,
  }),
  get_overdue_tasks: z.object({
    company_id: uuid.optional(),
  }),
  get_unbilled_work: z.object({
    company_id: uuid.optional(),
  }),
  search_activity: z.object({
    company_id: uuid.optional(),
    since: optionalString,
    limit: z.number().int().min(1).max(50).optional(),
  }),
  search_reports: z.object({
    company_id: uuid.optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  search_documents: z.object({
    company_id: uuid.optional(),
    query: optionalString,
    limit: z.number().int().min(1).max(30).optional(),
  }),
  search_company_resources: z.object({
    company_id: uuid.optional(),
    query: optionalString,
    category: z.enum(RESOURCE_CATEGORIES).optional(),
  }),
  search_company_memories: z.object({
    company_id: uuid,
    query: optionalString,
  }),
} as const;

// --- Écriture (proposées puis confirmées) ------------------------------

export const writeSchemas = {
  create_company: z.object({
    name: z.string().min(1),
    color: optionalString,
    contact_name: optionalString,
    contact_email: optionalString,
    contact_phone: optionalString,
    website: optionalString,
    notes: optionalString,
    monthly_amount: z.number().min(0).optional(),
    included_services: optionalString,
  }),
  create_project: z.object({
    company_id: uuid,
    name: z.string().min(1),
    description: optionalString,
  }),
  create_task: z.object({
    company_id: uuid,
    project_id: uuid.optional(),
    title: z.string().min(1),
    description: optionalString,
    category: z.enum(TASK_CATEGORIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    due_date: optionalString,
    estimated_minutes: z.number().int().min(0).optional(),
    billing_status: z.enum(BILLING_STATUSES).optional(),
    amount: z.number().min(0).optional(),
  }),
  update_task: z.object({
    task_id: uuid,
    title: optionalString,
    description: optionalString,
    category: z.enum(TASK_CATEGORIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    due_date: optionalString,
    estimated_minutes: z.number().int().min(0).optional(),
    billing_status: z.enum(BILLING_STATUSES).optional(),
    amount: z.number().min(0).optional(),
  }),
  complete_task: z.object({ task_id: uuid }),
  reopen_task: z.object({
    task_id: uuid,
    status: z.enum(TASK_STATUSES).optional(),
  }),
  log_time: z.object({
    company_id: uuid,
    task_id: uuid.optional(),
    minutes: z.number().int().min(1).max(1440),
    entry_date: optionalString,
    description: optionalString,
    is_billable: z.boolean().optional(),
  }),
  add_company_resource: z.object({
    company_id: uuid,
    label: z.string().min(1),
    url: z.url(),
    category: z.enum(RESOURCE_CATEGORIES).optional(),
    description: optionalString,
    login_hint: optionalString,
    is_favorite: z.boolean().optional(),
  }),
  attach_company_document: z.object({
    company_id: uuid,
    name: z.string().min(1),
    external_url: z.url(),
    description: optionalString,
  }),
  create_reminder: z.object({
    title: z.string().min(1),
    body: optionalString,
    company_id: uuid.optional(),
    frequency: z
      .enum(["ponctuel", "quotidien", "hebdomadaire", "mensuel"])
      .default("ponctuel"),
    /** Ponctuel : date et heure exactes, au format ISO local (Europe/Paris). */
    run_at: optionalString,
    /** Récurrent : heure au format HH:MM. */
    time_of_day: optionalString,
    /** 1 = lundi … 7 = dimanche. Requis pour un rappel hebdomadaire. */
    day_of_week: z.number().int().min(1).max(7).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
  }),
  create_automation_rule: z.object({
    kind: z.enum([
      "briefing_matin",
      "compte_rendu_soir",
      "rapport_hebdo",
      "relance_sans_reponse",
      "saisie_temps_manquante",
    ]),
    company_id: uuid.optional(),
    frequency: z
      .enum(["ponctuel", "quotidien", "hebdomadaire", "mensuel"])
      .default("quotidien"),
    time_of_day: optionalString,
    day_of_week: z.number().int().min(1).max(7).optional(),
    day_of_month: z.number().int().min(1).max(31).optional(),
    /** Ex. { "jours": 3 } pour une relance après trois jours sans réponse. */
    params: z.record(z.string(), z.unknown()).optional(),
  }),
  save_company_memory: z.object({
    company_id: uuid,
    content: z.string().min(1).max(2000),
    category: z
      .enum([
        "contexte_client",
        "preference",
        "consigne",
        "technique",
        "commercial",
        "autre",
      ])
      .optional(),
  }),
} as const;

export type ReadFunctionName = keyof typeof readSchemas;
export type WriteFunctionName = keyof typeof writeSchemas;
export type FunctionName = ReadFunctionName | WriteFunctionName;

export const READ_FUNCTION_NAMES = Object.keys(readSchemas) as ReadFunctionName[];
export const WRITE_FUNCTION_NAMES = Object.keys(
  writeSchemas
) as WriteFunctionName[];

export function isWriteFunction(name: string): name is WriteFunctionName {
  return WRITE_FUNCTION_NAMES.includes(name as WriteFunctionName);
}

export function isReadFunction(name: string): name is ReadFunctionName {
  return READ_FUNCTION_NAMES.includes(name as ReadFunctionName);
}

/** Descriptions destinées au modèle (en français, précises et courtes). */
const descriptions: Record<FunctionName, string> = {
  search_tasks:
    "Rechercher des tâches avec filtres (entreprise, statut, priorité, facturation, échéance).",
  get_company_summary:
    "Résumé d'une entreprise sur une période : tâches terminées, en cours, temps passé, prestations à facturer.",
  get_overdue_tasks: "Lister les tâches en retard (échéance dépassée).",
  get_unbilled_work:
    "Lister les prestations supplémentaires ou à facturer, avec les montants.",
  search_activity: "Consulter l'historique des actions enregistrées.",
  search_reports: "Lister les rapports existants et leur statut.",
  search_documents: "Rechercher des documents, livrables et liens.",
  search_company_resources:
    "Rechercher les accès rapides d'une entreprise (site, Search Console, réseaux sociaux…).",
  search_company_memories:
    "Consulter les consignes et informations durables retenues pour une entreprise.",
  create_company: "Créer une nouvelle entreprise cliente.",
  create_project: "Créer un projet dans une entreprise.",
  create_task:
    "Créer une tâche. L'entreprise est obligatoire ; le projet est facultatif.",
  update_task: "Modifier une tâche existante (seuls les champs fournis changent).",
  complete_task: "Marquer une tâche comme terminée.",
  reopen_task: "Rouvrir une tâche terminée.",
  log_time:
    "Enregistrer du temps passé, en minutes, pour une entreprise et éventuellement une tâche.",
  add_company_resource:
    "Ajouter un accès rapide (URL) pour une entreprise. Jamais de mot de passe ni de clé.",
  attach_company_document: "Ajouter un lien de document à une entreprise.",
  save_company_memory:
    "Retenir durablement une consigne ou préférence d'une entreprise. À n'utiliser QUE si l'utilisateur demande explicitement de retenir l'information ou confirme une proposition. Jamais pour des données déjà présentes (tâches, temps, rapports).",
  create_reminder:
    "Programmer un rappel personnel. Pour « rappelle-moi vendredi à 15 h », utiliser frequency='ponctuel' et run_at avec la date calculée au format AAAA-MM-JJTHH:MM. Pour « chaque vendredi », utiliser frequency='hebdomadaire', day_of_week=5 et time_of_day.",
  create_automation_rule:
    "Créer une automatisation récurrente : briefing du matin, compte rendu du soir, préparation automatique du rapport hebdomadaire (rapport_hebdo, exige company_id), relance quand un client ne répond pas, ou alerte de temps non saisi. Pour « chaque vendredi prépare le rapport de X », utiliser kind='rapport_hebdo', frequency='hebdomadaire', day_of_week=5.",
};

/**
 * Convertit les schémas Zod en outils pour la Responses API.
 * Le mode `strict` d'OpenAI impose `additionalProperties: false` et exige que
 * toutes les propriétés figurent dans `required` : on ne l'utilise pas, nos
 * arguments étant largement optionnels et revalidés par Zod de toute façon.
 */
export function buildToolDefinitions() {
  const all = { ...readSchemas, ...writeSchemas } as Record<
    string,
    z.ZodType
  >;

  return Object.entries(all).map(([name, schema]) => ({
    type: "function" as const,
    name,
    description: descriptions[name as FunctionName],
    parameters: z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>,
    strict: false,
  }));
}

/** Valide les arguments d'un appel de fonction. */
export function validateFunctionArguments(
  name: string,
  args: unknown
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string } {
  const schema =
    (readSchemas as Record<string, z.ZodType>)[name] ??
    (writeSchemas as Record<string, z.ZodType>)[name];

  if (!schema) {
    return { ok: false, error: `Fonction inconnue : ${name}.` };
  }

  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "argument"} : ${i.message}`)
          .join(" ; ") || "Arguments invalides.",
    };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
