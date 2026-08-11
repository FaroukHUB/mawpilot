-- MAW Pilot — Migration 8 : rappels, automatisations et notifications
--
-- Principe : l'application déclenche, l'IA rédige, l'utilisateur décide.
-- Rien de sortant (message à un client, suppression) n'est jamais automatique :
-- seules les notifications personnelles et les brouillons le sont.
--
-- L'exécution est IDEMPOTENTE : `automation_runs` porte une contrainte
-- d'unicité sur (source, occurrence). Si le planificateur déclenche deux fois
-- la même occurrence, la seconde est ignorée sans effet de bord.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.reminder_frequency as enum
  ('ponctuel', 'quotidien', 'hebdomadaire', 'mensuel');

create type public.reminder_status as enum
  ('actif', 'termine', 'annule');

create type public.automation_kind as enum
  ('briefing_matin',        -- urgences, retards, priorités du jour
   'compte_rendu_soir',     -- invitation à dicter la journée
   'rapport_hebdo',         -- brouillon de rapport préparé automatiquement
   'relance_sans_reponse',  -- tâche en attente client depuis N jours
   'saisie_temps_manquante' -- aucun temps enregistré depuis N jours
  );

create type public.automation_run_status as enum
  ('succes', 'ignore', 'echec');

create type public.notification_channel as enum
  ('interne', 'push', 'email');

-- ---------------------------------------------------------------------------
-- Rappels (ponctuels et récurrents)
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  body text,
  frequency public.reminder_frequency not null default 'ponctuel',
  -- Prochaine échéance calculée par l'application (UTC).
  next_run_at timestamptz not null,
  -- Pour les récurrences : heure locale et jour de référence.
  time_of_day time not null default '09:00',
  timezone text not null default 'Europe/Paris',
  day_of_week integer check (day_of_week between 1 and 7),   -- 1 = lundi
  day_of_month integer check (day_of_month between 1 and 31),
  status public.reminder_status not null default 'actif',
  last_run_at timestamptz,
  source public.creation_source not null default 'manuelle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_recurrence_coherente check (
    (frequency = 'ponctuel')
    or (frequency = 'quotidien')
    or (frequency = 'hebdomadaire' and day_of_week is not null)
    or (frequency = 'mensuel' and day_of_month is not null)
  )
);
comment on table public.reminders is
  'Rappels personnels, ponctuels ou récurrents. Déclenchent une notification, '
  'jamais un message vers un client.';

create index reminders_due_idx
  on public.reminders (next_run_at)
  where status = 'actif';
create index reminders_user_idx on public.reminders (user_id, next_run_at);

-- ---------------------------------------------------------------------------
-- Règles d'automatisation
-- ---------------------------------------------------------------------------

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  kind public.automation_kind not null,
  -- Planification : quotidienne par défaut, hebdomadaire pour les rapports.
  frequency public.reminder_frequency not null default 'quotidien',
  time_of_day time not null default '08:00',
  timezone text not null default 'Europe/Paris',
  day_of_week integer check (day_of_week between 1 and 7),
  day_of_month integer check (day_of_month between 1 and 31),
  -- Paramètres propres à la règle, ex. {"jours": 3} pour une relance.
  params jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.automation_rules is
  'Règles déclenchées par le planificateur serveur. Ne produisent que des '
  'notifications et des brouillons : jamais d''envoi vers un tiers.';

create index automation_rules_active_idx
  on public.automation_rules (user_id) where is_active;

-- ---------------------------------------------------------------------------
-- Historique d'exécution — garantit l'idempotence
-- ---------------------------------------------------------------------------

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('reminder', 'rule')),
  source_id uuid not null,
  -- Identifie l'occurrence, ex. « 2026-08-14T15:00 ». Deux exécutions de la
  -- même occurrence sont impossibles grâce à l'unicité ci-dessous.
  occurrence_key text not null,
  status public.automation_run_status not null default 'succes',
  detail text,
  result jsonb,
  created_at timestamptz not null default now()
);

create unique index automation_runs_unique_occurrence
  on public.automation_runs (source_type, source_id, occurrence_key);
create index automation_runs_user_idx
  on public.automation_runs (user_id, created_at desc);

comment on index public.automation_runs_unique_occurrence is
  'Garantit l''idempotence : une occurrence donnée ne peut s''exécuter '
  'qu''une seule fois, même si le planificateur se déclenche en double.';

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text,
  url text,
  -- Canaux réellement utilisés et leur résultat, ex.
  -- {"push": "envoye", "email": "non_configure"}
  delivery jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Abonnements aux notifications push (PWA)
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.push_subscriptions is
  'Abonnements Web Push par appareil. Un abonnement expiré (410/404) est '
  'supprimé automatiquement lors de l''envoi.';

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'reminders', 'automation_rules', 'notifications', 'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select
       using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert
       with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete
       using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- L'historique d'exécution est consultable mais non modifiable (même esprit
-- que activity_logs) : pas de politique UPDATE ni DELETE.
alter table public.automation_runs enable row level security;

create policy "automation_runs_select_own" on public.automation_runs
  for select using ((select auth.uid()) = user_id);
create policy "automation_runs_insert_own" on public.automation_runs
  for insert with check ((select auth.uid()) = user_id);
