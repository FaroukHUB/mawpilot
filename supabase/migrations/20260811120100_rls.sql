-- MAW Pilot — Migration 2 : Row Level Security
-- Chaque ligne n'est visible et modifiable que par son propriétaire (user_id).
-- La RLS est le filet de sécurité de second niveau : le serveur applicatif
-- vérifie de toute façon l'appartenance avant chaque écriture.

-- ---------------------------------------------------------------------------
-- profiles : accès à son propre profil uniquement (clé = id)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de politique DELETE : un profil ne se supprime pas depuis l'application.

-- ---------------------------------------------------------------------------
-- activity_logs : historique immuable (lecture + insertion, jamais de
-- mise à jour ni de suppression — l'absence de politique vaut interdiction)
-- ---------------------------------------------------------------------------

alter table public.activity_logs enable row level security;

create policy "activity_logs_select_own" on public.activity_logs
  for select using ((select auth.uid()) = user_id);

create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Toutes les autres tables métier : CRUD limité au propriétaire
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'company_contacts', 'company_channels', 'company_resources',
    'projects', 'tasks', 'company_documents', 'time_entries', 'ai_requests',
    'reports', 'report_attachments', 'report_deliveries', 'report_schedules'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select
       using ((select auth.uid()) = user_id)',
      t || '_select_own', t);

    execute format(
      'create policy %I on public.%I for insert
       with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);

    execute format(
      'create policy %I on public.%I for update
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);

    execute format(
      'create policy %I on public.%I for delete
       using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end;
$$;
