-- MAW Pilot — Migration 4 : sécurité du stockage privé
-- Le bucket « documents » est créé depuis le dashboard Supabase (privé).
-- Convention de chemin : <user_id>/<company_id>/<horodatage>-<nom de fichier>
-- Le premier segment du chemin porte l'identifiant du propriétaire : chaque
-- utilisateur n'accède qu'à ses propres fichiers. L'accès en lecture se fait
-- exclusivement par URL signée à durée limitée, générée côté serveur.

-- Filet de sécurité : crée le bucket s'il n'existe pas déjà (toujours privé).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Lecture : uniquement ses propres fichiers.
create policy "documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Dépôt : uniquement dans son propre dossier.
create policy "documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Remplacement : uniquement ses propres fichiers.
create policy "documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Suppression : uniquement ses propres fichiers.
create policy "documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
