import type {
  BillingStatus,
  ProjectStatus,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@/lib/enums";

export const taskStatusLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente_client: "En attente client",
  bloquee: "Bloquée",
  terminee: "Terminée",
  archivee: "Archivée",
};

export const taskStatusBadgeClass: Record<TaskStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  a_faire: "bg-secondary text-secondary-foreground",
  en_cours: "bg-brand-yellow/30 text-foreground",
  en_attente_client: "bg-sky-100 text-sky-900",
  bloquee: "bg-destructive/15 text-destructive",
  terminee: "bg-emerald-100 text-emerald-900",
  archivee: "bg-muted text-muted-foreground",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  faible: "Faible",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

export const taskPriorityBadgeClass: Record<TaskPriority, string> = {
  faible: "bg-muted text-muted-foreground",
  normale: "bg-secondary text-secondary-foreground",
  haute: "bg-brand-orange/20 text-orange-900",
  urgente: "bg-destructive text-destructive-foreground",
};

export const taskCategoryLabels: Record<TaskCategory, string> = {
  developpement: "Développement",
  seo: "SEO",
  maintenance: "Maintenance",
  design: "Design",
  commercial: "Commercial",
  administratif: "Administratif",
  logistique: "Logistique",
  autre: "Autre",
};

export const billingStatusLabels: Record<BillingStatus, string> = {
  incluse: "Incluse",
  supplementaire: "Supplémentaire",
  offerte: "Offerte",
  a_facturer: "À facturer",
  facturee: "Facturée",
};

export const billingStatusBadgeClass: Record<BillingStatus, string> = {
  incluse: "bg-muted text-muted-foreground",
  supplementaire: "bg-brand-yellow/30 text-foreground",
  offerte: "bg-sky-100 text-sky-900",
  a_facturer: "bg-brand-orange/20 text-orange-900",
  facturee: "bg-emerald-100 text-emerald-900",
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  actif: "Actif",
  en_pause: "En pause",
  termine: "Terminé",
  archive: "Archivé",
};
