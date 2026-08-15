-- MAW Pilot — Migration 14 : réponse du prestataire et pièces jointes client
--
-- Deux manques constatés à l'usage :
--
-- 1. Le client ne savait pas qu'une réponse lui avait été faite. La réponse
--    existait dans la conversation, mais la demande elle-même n'en portait
--    aucune trace : on ajoute donc la réponse et sa date SUR la demande, ce
--    qui permet d'afficher un état « Réponse obtenue » sans deviner.
--
-- 2. Le client ne pouvait rien joindre. Une capture d'écran, une photo du
--    problème ou un PDF valent souvent mieux qu'un paragraphe.
--
-- Les fichiers vont dans le bucket privé existant (`documents`), au chemin
-- `<prestataire>/clients/<entreprise>/…` : la politique Storage en place
-- donne ainsi au prestataire l'accès à ces fichiers sans nouvelle règle. Le
-- client, lui, ne touche JAMAIS au Storage directement : le téléversement
-- passe par une action serveur qui valide le type et la taille, et la
-- consultation par une URL signée à durée limitée.

-- ---------------------------------------------------------------------------
-- Réponse du prestataire, portée par la demande
-- ---------------------------------------------------------------------------

alter table public.client_requests
  add column if not exists owner_reply text,
  add column if not exists owner_replied_at timestamptz;

comment on column public.client_requests.owner_reply is
  'Dernière réponse écrite par le prestataire lui-même. Distincte de '
  'assistant_reply, qui est la réponse automatique de l''assistant.';

comment on column public.client_requests.owner_replied_at is
  'Date de cette réponse. Sa présence suffit à afficher « Réponse obtenue » '
  'côté client : aucun statut supplémentaire n''est nécessaire.';

-- ---------------------------------------------------------------------------
-- Pièces jointes déposées par le client
-- ---------------------------------------------------------------------------

create table if not exists public.client_attachments (
  id uuid primary key default gen_random_uuid(),
  -- Propriétaire du dossier : c'est lui qui « possède » le fichier.
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  request_id uuid references public.client_requests (id) on delete cascade,
  message_id uuid references public.client_messages (id) on delete set null,
  uploaded_by public.client_message_author not null default 'client',
  name text not null,
  -- Chemin dans le bucket privé `documents`, préfixe `clients/`.
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

comment on table public.client_attachments is
  'Fichiers joints par le client à ses demandes. Stockés dans le bucket '
  'privé, jamais exposés autrement que par URL signée.';

create index if not exists client_attachments_request_idx
  on public.client_attachments (request_id);
create index if not exists client_attachments_company_idx
  on public.client_attachments (company_id, created_at desc);

alter table public.client_attachments enable row level security;

-- Le prestataire gère les pièces jointes de ses entreprises.
create policy "client_attachments_owner_all" on public.client_attachments
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Le client lit celles de son entreprise. Il n'insère pas directement :
-- le téléversement passe par le serveur, qui valide le fichier.
create policy "client_attachments_client_read" on public.client_attachments
  for select using (company_id = public.client_company_id());
