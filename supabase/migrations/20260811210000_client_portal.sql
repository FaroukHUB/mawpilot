-- MAW Pilot — Migration 11 : portail client
--
-- MODÈLE D'ACCÈS : lien privé par contact (D-024).
-- Aucun compte, aucun mot de passe. Le jeton est stocké HACHÉ (SHA-256) :
-- même avec un accès à la base, on ne peut pas reconstituer un lien valide.
--
-- RÈGLE DE CONCEPTION : le portail ne contient QUE des informations que
-- l'utilisateur accepterait de voir transférées. Jamais de temps réel, de
-- montant, de note interne, de mémoire IA ni d'accès rapide.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.client_request_status as enum
  ('nouvelle',        -- déposée par le client, pas encore traitée
   'en_analyse',      -- l'IA a répondu, en attente de l'utilisateur
   'acceptee',        -- convertie en tâche
   'hors_forfait',    -- signalée comme prestation supplémentaire
   'refusee',
   'archivee');

create type public.client_request_classification as enum
  ('incluse', 'supplementaire', 'question', 'indeterminee');

create type public.client_message_author as enum
  ('client', 'assistant', 'utilisateur');

-- ---------------------------------------------------------------------------
-- Jetons d'accès au portail
-- ---------------------------------------------------------------------------

create table public.client_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.company_contacts (id) on delete set null,
  label text not null,
  -- Préfixe public (12 caractères) : sert à retrouver la ligne sans révéler
  -- le jeton. Le secret complet n'existe QUE dans le lien envoyé au client.
  token_prefix text not null unique,
  token_hash text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.client_access_tokens is
  'Liens privés d''accès au portail client. Jeton haché : irrécupérable '
  'depuis la base. Révocable et expirable individuellement.';

create index client_access_tokens_company_idx
  on public.client_access_tokens (company_id);

-- ---------------------------------------------------------------------------
-- Charte du portail, par entreprise
-- ---------------------------------------------------------------------------

create table public.client_portal_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_enabled boolean not null default true,
  welcome_message text,
  -- Ce que couvre le forfait, en langage naturel : sert de référence à l'IA
  -- pour classer une demande.
  included_scope text,
  -- Ce qui est explicitement hors forfait.
  excluded_scope text,
  -- Quota de demandes incluses par mois (0 = illimité).
  monthly_request_quota integer not null default 0,
  -- Phrase EXACTE utilisée quand une demande sort du forfait. L'IA ne la
  -- reformule pas : c'est la voix de l'utilisateur, pas la sienne.
  out_of_scope_message text not null default
    'Cette demande sort des prestations incluses dans votre forfait. Je la transmets pour étude, vous recevrez une proposition rapidement.',
  -- Phrase utilisée quand le quota mensuel est dépassé.
  quota_reached_message text not null default
    'Vous avez atteint le nombre de demandes incluses ce mois-ci. Votre demande est enregistrée et sera étudiée en priorité le mois prochain, ou plus tôt sur devis.',
  tone text not null default 'professionnel et chaleureux',
  -- L'assistant peut-il répondre directement au client ?
  ai_reply_enabled boolean not null default true,
  -- Le client peut-il dicter ses demandes ?
  voice_enabled boolean not null default true,
  -- Sections visibles dans le portail.
  show_completed boolean not null default true,
  show_in_progress boolean not null default true,
  show_waiting_client boolean not null default true,
  show_upcoming boolean not null default true,
  show_documents boolean not null default true,
  show_reports boolean not null default true,
  show_metrics boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.client_portal_settings is
  'Charte du portail par entreprise. Les messages de refus sont figés et '
  'validés par l''utilisateur : l''IA ne les reformule jamais.';

-- ---------------------------------------------------------------------------
-- Demandes déposées par le client
-- ---------------------------------------------------------------------------

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  token_id uuid references public.client_access_tokens (id) on delete set null,
  contact_name text,
  -- Texte tel que déposé (ou transcription de la dictée).
  content text not null,
  -- Transcription brute conservée si la demande a été dictée.
  raw_transcription text,
  is_voice boolean not null default false,
  classification public.client_request_classification not null default 'indeterminee',
  -- Réponse de l'assistant réellement affichée au client.
  assistant_reply text,
  status public.client_request_status not null default 'nouvelle',
  -- Tâche créée après validation de l'utilisateur.
  task_id uuid references public.tasks (id) on delete set null,
  -- Date communiquée au client — UNIQUEMENT après confirmation de
  -- l'utilisateur. Jamais renseignée par l'IA seule.
  promised_date date,
  promised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.client_requests.promised_date is
  'Date communiquée au client. Renseignée uniquement après confirmation '
  'explicite de l''utilisateur : l''IA ne s''engage jamais à sa place.';

create index client_requests_company_idx
  on public.client_requests (company_id, created_at desc);
create index client_requests_status_idx
  on public.client_requests (user_id, status);

-- ---------------------------------------------------------------------------
-- Conversation du portail
-- ---------------------------------------------------------------------------

create table public.client_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  request_id uuid references public.client_requests (id) on delete cascade,
  author public.client_message_author not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index client_messages_company_idx
  on public.client_messages (company_id, created_at);

-- ---------------------------------------------------------------------------
-- Visibilité côté client : tout est masqué par défaut sauf mention contraire
-- ---------------------------------------------------------------------------

-- Les tâches sont visibles par défaut (le client doit voir l'avancement),
-- avec possibilité de masquer une tâche au titre trop interne.
alter table public.tasks
  add column if not exists is_client_visible boolean not null default true;

-- Les documents sont MASQUÉS par défaut : un livrable se partage
-- volontairement, il peut contenir des éléments de travail internes.
alter table public.company_documents
  add column if not exists is_client_visible boolean not null default false;

comment on column public.company_documents.is_client_visible is
  'Masqué par défaut : un document n''apparaît dans le portail que si '
  'l''utilisateur le partage explicitement.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.client_access_tokens
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.client_portal_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.client_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Ces tables ne sont accessibles qu'au propriétaire via l'application.
-- Le portail client, lui, n'a AUCUNE session : il passe par le serveur, qui
-- valide le jeton puis restreint chaque requête à l'entreprise concernée
-- (voir src/lib/client-portal/data.ts — point d'audit unique).

do $$
declare
  t text;
begin
  foreach t in array array[
    'client_access_tokens', 'client_portal_settings',
    'client_requests', 'client_messages'
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
