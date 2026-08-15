-- MAW Pilot — Migration 13 : comptes clients
--
-- Le client se connecte avec un compte que VOUS créez dans Supabase.
-- Aucune inscription publique : c'est vous qui donnez l'accès, comme pour
-- votre propre compte.
--
-- Cette table relie un compte `auth.users` à une entreprise. Elle est la
-- seule chose qui distingue un client d'un propriétaire : si un compte y
-- figure, il est redirigé vers son espace client au lieu du tableau de bord.

create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  -- Compte du client (créé dans Authentication → Users).
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Propriétaire du dossier : c'est vous.
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.company_contacts (id) on delete set null,
  display_name text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_users is
  'Relie un compte Supabase à une entreprise cliente. Un compte présent ici '
  'accède à l''espace client, jamais au tableau de bord du propriétaire.';

create index client_users_company_idx on public.client_users (company_id);
create index client_users_owner_idx on public.client_users (owner_user_id);

create trigger set_updated_at before update on public.client_users
  for each row execute function public.set_updated_at();

alter table public.client_users enable row level security;

-- Le propriétaire gère les accès de ses entreprises.
create policy "client_users_owner_all" on public.client_users
  for all
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

-- Le client peut lire sa propre ligne (pour savoir à quelle entreprise il
-- appartient). Il ne peut rien modifier.
create policy "client_users_read_self" on public.client_users
  for select using ((select auth.uid()) = auth_user_id);

-- ---------------------------------------------------------------------------
-- Accès en lecture des clients à leurs propres données
-- ---------------------------------------------------------------------------
-- Ces politiques s'ajoutent à celles du propriétaire (elles ne les remplacent
-- pas). Un client ne voit que l'entreprise à laquelle son compte est rattaché,
-- et uniquement en lecture.

create or replace function public.client_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id
    from public.client_users
   where auth_user_id = auth.uid()
     and is_active
   limit 1;
$$;

comment on function public.client_company_id is
  'Entreprise du client connecté, ou NULL s''il n''est pas un client. '
  'Sert de base aux politiques de lecture de l''espace client.';

grant execute on function public.client_company_id() to authenticated;

-- Tâches : visibles si l'entreprise correspond et si elles ne sont pas
-- masquées. Les colonnes sensibles (montants, facturation) ne sont jamais
-- envoyées au client : c'est le code de l'espace client qui les exclut.
create policy "tasks_client_read" on public.tasks
  for select using (
    company_id = public.client_company_id()
    and is_client_visible
    and status <> 'archivee'
  );

create policy "projects_client_read" on public.projects
  for select using (company_id = public.client_company_id());

create policy "companies_client_read" on public.companies
  for select using (id = public.client_company_id());

create policy "documents_client_read" on public.company_documents
  for select using (
    company_id = public.client_company_id()
    and is_client_visible
    and status = 'actif'
  );

-- Seuls les rapports déjà partagés.
create policy "reports_client_read" on public.reports
  for select using (
    company_id = public.client_company_id()
    and status = 'partage'
  );

-- Demandes et conversation : le client lit les siennes et peut en créer.
create policy "client_requests_client_read" on public.client_requests
  for select using (company_id = public.client_company_id());

create policy "client_requests_client_insert" on public.client_requests
  for insert with check (company_id = public.client_company_id());

create policy "client_messages_client_read" on public.client_messages
  for select using (company_id = public.client_company_id());

create policy "client_messages_client_insert" on public.client_messages
  for insert with check (company_id = public.client_company_id());

create policy "portal_settings_client_read" on public.client_portal_settings
  for select using (company_id = public.client_company_id());
