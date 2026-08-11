-- MAW Pilot — Migration 3 : conversations et mémoire de l'assistant IA
-- Principe : Supabase est la source de vérité de la mémoire. Les identifiants
-- de conversation OpenAI ne sont qu'un cache d'optimisation, jamais une
-- dépendance (l'application doit fonctionner s'ils sont perdus).

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

create type public.ai_message_role as enum
  ('user', 'assistant', 'system', 'tool');

create type public.memory_category as enum
  ('contexte_client', 'preference', 'consigne', 'technique', 'commercial',
   'autre');

create type public.memory_source as enum
  ('utilisateur',   -- saisie ou demande explicite de l'utilisateur
   'ia_confirmee',  -- proposée par l'IA puis confirmée par l'utilisateur
   'donnees');      -- déduite directement des données enregistrées

create type public.memory_status as enum
  ('confirmee', 'a_verifier');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  -- company_id NULL = conversation globale (questions multi-entreprises)
  title text not null default 'Nouvelle conversation',
  summary text,                    -- résumé roulant maintenu par l'application
  openai_conversation_id text,     -- cache facultatif (Conversations API)
  last_message_at timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ai_conversations is
  'Conversations avec l''assistant : une globale ou une par entreprise. '
  'Source de vérité locale ; les identifiants OpenAI ne sont qu''un cache.';

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  ai_request_id uuid references public.ai_requests (id) on delete set null,
  -- lien vers la demande interprétée (actions proposées/exécutées)
  metadata jsonb,
  created_at timestamptz not null default now()
);
comment on table public.ai_messages is
  'Historique utile des échanges avec l''assistant, conservé localement.';

create table public.company_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  content text not null,
  category public.memory_category not null default 'autre',
  source public.memory_source not null,
  status public.memory_status not null default 'a_verifier',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.company_memories is
  'Informations durables par entreprise. Une supposition de l''IA ne devient '
  'jamais automatiquement un souvenir : enregistrement uniquement sur demande '
  'explicite ou après confirmation (source/status le tracent).';

-- ---------------------------------------------------------------------------
-- Triggers updated_at et index
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.company_memories
  for each row execute function public.set_updated_at();

create index ai_conversations_user_idx
  on public.ai_conversations (user_id, last_message_at desc);
create index ai_conversations_company_idx
  on public.ai_conversations (company_id);
create index ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);
create index company_memories_company_idx
  on public.company_memories (company_id)
  where not is_archived;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.company_memories enable row level security;

-- ai_conversations et company_memories : CRUD complet du propriétaire.
do $$
declare
  t text;
begin
  foreach t in array array['ai_conversations', 'company_memories'] loop
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

-- ai_messages : lecture, insertion et suppression (pas de réécriture d'un
-- message existant ; la suppression passe surtout par celle de la conversation).
create policy "ai_messages_select_own" on public.ai_messages
  for select using ((select auth.uid()) = user_id);
create policy "ai_messages_insert_own" on public.ai_messages
  for insert with check ((select auth.uid()) = user_id);
create policy "ai_messages_delete_own" on public.ai_messages
  for delete using ((select auth.uid()) = user_id);
