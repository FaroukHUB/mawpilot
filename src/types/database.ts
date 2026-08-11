import type {
  BillingStatus,
  CreationSource,
  ProjectStatus,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@/lib/enums";

/**
 * Types des tables Supabase utilisées par l'application.
 * (Écrits à la main : la génération automatique de types nécessite un accès
 * réseau à Supabase, indisponible dans l'environnement de développement.)
 */

export interface Company {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  color: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  monthly_amount: number | null;
  included_services: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number;
  billing_status: BillingStatus;
  amount: number | null;
  tags: string[];
  source: CreationSource;
  created_at: string;
  updated_at: string;
}

export type CompanyRef = Pick<Company, "id" | "name" | "color">;

export interface TaskWithRefs extends Task {
  companies: CompanyRef | null;
  projects: Pick<Project, "id" | "name"> | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  company_id: string | null;
  project_id: string | null;
  task_id: string | null;
  action_type: string;
  description: string;
  before_data: unknown;
  after_data: unknown;
  source: "manuelle" | "ia";
  created_at: string;
}
