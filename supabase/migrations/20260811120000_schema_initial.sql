-- MAW Pilot — Migration 1 : schéma initial
-- Toutes les tables métier portent user_id, created_at, updated_at.
-- Les valeurs d'énumération sont des slugs français sans accents ;
-- les libellés affichés (avec accents) vivent dans le code de l'interface.

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

create type public.project_status as enum
  ('actif', 'en_pause', 'termine', 'archive');

create type public.task_category as enum
  ('developpement', 'seo', 'maintenance', 'design', 'commercial',
   'administratif', 'logistique', 'autre');

create type public.task_status as enum
  ('backlog', 'a_faire', 'en_cours', 'en_attente_client', 'bloquee',
   'terminee', 'archivee');

create type public.task_priority as enum
  ('faible', 'normale', 'haute', 'urgente');

create type public.billing_status as enum
  ('incluse', 'supplementaire', 'offerte', 'a_facturer', 'facturee');

create type public.creation_source as enum
  ('manuelle', 'ia_texte', 'ia_voix');

create type public.channel_type as enum
  ('whatsapp_direct', 'whatsapp_groupe', 'email', 'autre');

create type public.resource_category as enum
  ('site_public', 'administration_site', 'hebergement', 'domaine_dns',
   'github', 'vercel', 'supabase', 'shopify', 'wordpress',
   'search_console', 'google_analytics', 'google_tag_manager',
   'google_business_profile', 'google_ads', 'metricool',
   'meta_business_suite', 'facebook', 'instagram', 'linkedin', 'tiktok',
   'youtube', 'canva', 'stockage_documents', 'autre');

create type public.document_type as enum
  ('fichier', 'lien_externe', 'document_genere', 'tableau_genere');

create type public.document_status as enum
  ('actif', 'archive');

create type public.activity_source as enum
  ('manuelle', 'ia');

create type public.ai_request_status as enum
  ('proposee', 'confirmee', 'executee', 'annulee', 'echouee');

create type public.report_type as enum
  ('hebdomadaire', 'mensuel', 'personnalise');

create type public.report_status as enum
  ('brouillon', 'pret', 'partage', 'archive');

create type public.attachment_type as enum
  ('document', 'tableau', 'url', 'fichier');

create type public.delivery_method as enum
  ('whatsapp_direct', 'partage_natif', 'copier_coller', 'telechargement',
   'email');

create type public.delivery_status as enum
  ('prepare', 'partage_manuellement', 'confirme_envoye', 'echec');

create type public.schedule_frequency as enum
  ('hebdomadaire', 'mensuel');

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Crée automatiquement le profil à la création d'un compte auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  avatar_url text,
  timezone text not null default 'Europe/Paris',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'Profil utilisateur lié à auth.users (créé automatiquement).';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  logo_url text,
  color text not null default '#FFA000',
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  notes text,
  is_active boolean not null default true,
  monthly_amount numeric(10, 2),
  included_services text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.companies is 'Entreprises clientes.';

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  whatsapp_number text, -- format international +XXX…, validé côté serveur
  preferred_channel text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_contacts is
  'Personnes de contact au sein de chaque entreprise.';

create table public.company_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  type public.channel_type not null,
  label text not null,
  contact_id uuid references public.company_contacts (id) on delete set null,
  phone_number text, -- requis pour un WhatsApp direct (format international)
  group_name text,   -- aide-mémoire pour un groupe WhatsApp, pas un ciblage
  open_url text,     -- uniquement si une URL réellement exploitable existe
  instructions text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_direct_requires_phone
    check (type <> 'whatsapp_direct' or phone_number is not null)
);
comment on table public.company_channels is
  'Destinations de communication (rapports) par entreprise.';

-- Un seul canal par défaut par entreprise.
create unique index one_default_channel_per_company
  on public.company_channels (company_id)
  where is_default;

create table public.company_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  category public.resource_category not null default 'autre',
  label text not null,
  url text not null,
  description text,
  access_notes text,          -- notes d'accès NON sensibles uniquement
  login_hint text,            -- identifiant ou email de connexion, jamais de mot de passe
  password_manager_ref text,  -- nom/URL d'une entrée de gestionnaire de mots de passe
  is_favorite boolean not null default false,
  sort_order integer not null default 0,
  last_checked_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_resources is
  'Accès rapides par entreprise. Ne doit JAMAIS contenir de secret.';

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'actif',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.projects is 'Projets par entreprise.';

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  category public.task_category not null default 'autre',
  status public.task_status not null default 'a_faire',
  priority public.task_priority not null default 'normale',
  due_date date,
  completed_at timestamptz,
  estimated_minutes integer check (estimated_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  billing_status public.billing_status not null default 'incluse',
  amount numeric(10, 2),
  tags text[] not null default '{}',
  source public.creation_source not null default 'manuelle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.tasks is
  'Tâches. actual_minutes est maintenu par l''application à partir de time_entries.';

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  name text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  type public.document_type not null,
  storage_path text,   -- chemin Supabase Storage (bucket privé) si fichier
  external_url text,   -- URL si lien externe
  mime_type text,
  size_bytes bigint,
  version text,
  document_date date,
  status public.document_status not null default 'actif',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_documents is
  'Documents, tableaux, livrables et liens par entreprise.';

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  minutes integer not null check (minutes > 0),
  entry_date date not null default current_date,
  description text,
  is_billable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.time_entries is 'Temps passé, en minutes.';

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  action_type text not null,
  description text not null,
  before_data jsonb,
  after_data jsonb,
  source public.activity_source not null default 'manuelle',
  created_at timestamptz not null default now()
);
comment on table public.activity_logs is
  'Historique immuable des actions (pas de mise à jour ni de suppression).';

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_message text not null,   -- message texte ou transcription vocale
  input_mode public.creation_source not null default 'ia_texte',
  intent text,
  proposed_actions jsonb,
  status public.ai_request_status not null default 'proposee',
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ai_requests is
  'Demandes adressées à l''assistant IA et leur cycle de vie.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  type public.report_type not null,
  period_start date not null,
  period_end date not null,
  title text not null,
  status public.report_status not null default 'brouillon',
  source_data jsonb,             -- faits figés au moment de la génération
  raw_dictation text,
  corrected_transcription text,
  content jsonb,                 -- sections structurées du rapport
  whatsapp_text text,            -- version courte formatée pour WhatsApp
  long_text text,                -- version longue pour document
  generated_at timestamptz,
  shared_at timestamptz,
  author_source public.activity_source not null default 'manuelle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_period_valid check (period_end >= period_start)
);
comment on table public.reports is
  'Rapports hebdomadaires, mensuels ou personnalisés par entreprise.';

create table public.report_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  company_document_id uuid references public.company_documents (id) on delete set null,
  type public.attachment_type not null,
  label text not null,
  url text,
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.report_attachments is 'Pièces jointes des rapports.';

create table public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  company_channel_id uuid references public.company_channels (id) on delete set null,
  destination_label text not null,
  method public.delivery_method not null,
  prepared_content text,
  prepared_files jsonb,
  status public.delivery_status not null default 'prepare',
  delivered_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.report_deliveries is
  'Partages de rapports. Le statut « confirme_envoye » exige une confirmation manuelle.';

create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  frequency public.schedule_frequency not null,
  day_of_week integer check (day_of_week between 1 and 7),   -- 1 = lundi
  day_of_month integer check (day_of_month between 1 and 31),
  time_of_day time not null default '09:00',
  timezone text not null default 'Europe/Paris',
  default_channel_id uuid references public.company_channels (id) on delete set null,
  template_name text,
  sections jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_day_matches_frequency check (
    (frequency = 'hebdomadaire' and day_of_week is not null)
    or (frequency = 'mensuel' and day_of_month is not null)
  )
);
comment on table public.report_schedules is
  'Planification des rapports : crée un rappel/brouillon, jamais d''envoi automatique.';

-- ---------------------------------------------------------------------------
-- Trigger updated_at sur toutes les tables qui en ont un
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'companies', 'company_contacts', 'company_channels',
    'company_resources', 'projects', 'tasks', 'company_documents',
    'time_entries', 'ai_requests', 'reports', 'report_attachments',
    'report_deliveries', 'report_schedules'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------

create index companies_user_idx on public.companies (user_id);
create index company_contacts_company_idx on public.company_contacts (company_id);
create index company_channels_company_idx on public.company_channels (company_id);
create index company_resources_company_idx on public.company_resources (company_id);
create index company_resources_order_idx on public.company_resources (company_id, sort_order);
create index projects_company_idx on public.projects (company_id);
create index tasks_user_idx on public.tasks (user_id);
create index tasks_company_idx on public.tasks (company_id);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);
create index company_documents_company_idx on public.company_documents (company_id);
create index time_entries_company_idx on public.time_entries (company_id);
create index time_entries_task_idx on public.time_entries (task_id);
create index time_entries_date_idx on public.time_entries (entry_date);
create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_company_idx on public.activity_logs (company_id);
create index ai_requests_user_created_idx on public.ai_requests (user_id, created_at desc);
create index reports_company_idx on public.reports (company_id);
create index report_attachments_report_idx on public.report_attachments (report_id);
create index report_deliveries_report_idx on public.report_deliveries (report_id);
create index report_schedules_company_idx on public.report_schedules (company_id);
