-- MAW Pilot — Migration 6 : suivi des coûts de l'assistant IA
--
-- Objectif : aucune surprise sur la facture OpenAI. Chaque demande enregistre
-- les jetons réellement consommés et son coût calculé. Le crédit restant est
-- une ESTIMATION : l'API OpenAI ne permet pas de lire le solde du compte, donc
-- l'utilisateur déclare le crédit acheté et l'application en déduit la
-- consommation mesurée.

-- Jetons et coût par demande.
alter table public.ai_requests
  add column if not exists model text,
  add column if not exists input_tokens integer not null default 0,
  add column if not exists cached_input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0,
  add column if not exists cost_usd numeric(12, 6) not null default 0;

comment on column public.ai_requests.cost_usd is
  'Coût calculé de la demande en dollars, à partir des jetons et du tarif '
  'configuré. Somme de tous les allers-retours modèle de la demande.';

create index if not exists ai_requests_cost_idx
  on public.ai_requests (user_id, created_at desc);

-- Budget déclaré par l'utilisateur.
create table if not exists public.ai_budget (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  -- Crédit acheté sur la plateforme OpenAI, saisi par l'utilisateur.
  credit_usd numeric(12, 2) not null default 0,
  -- Date à partir de laquelle la consommation est déduite de ce crédit.
  credit_since timestamptz not null default now(),
  -- Seuil d'alerte : prévenir quand il reste moins que ce montant.
  alert_threshold_usd numeric(12, 2) not null default 2,
  -- Tarifs en dollars par million de jetons (modifiables : les tarifs
  -- OpenAI évoluent, l'utilisateur les recopie depuis la page Tarifs).
  price_input_per_million numeric(12, 4) not null default 1.25,
  price_cached_input_per_million numeric(12, 4) not null default 0.125,
  price_output_per_million numeric(12, 4) not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_budget is
  'Budget IA déclaré par l''utilisateur et tarifs appliqués au calcul des '
  'coûts. Le crédit restant est une estimation locale : l''API OpenAI '
  'n''expose pas le solde du compte.';

create trigger set_updated_at before update on public.ai_budget
  for each row execute function public.set_updated_at();

alter table public.ai_budget enable row level security;

create policy "ai_budget_select_own" on public.ai_budget
  for select using ((select auth.uid()) = user_id);
create policy "ai_budget_insert_own" on public.ai_budget
  for insert with check ((select auth.uid()) = user_id);
create policy "ai_budget_update_own" on public.ai_budget
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "ai_budget_delete_own" on public.ai_budget
  for delete using ((select auth.uid()) = user_id);
