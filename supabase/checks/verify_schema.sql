-- MAW Pilot — Vérification de l'état de la base
-- À exécuter dans le SQL Editor : ne modifie rien, affiche seulement un état.
-- Chaque ligne doit afficher « OK ». Toute ligne « MANQUANT » indique une
-- migration à appliquer.

with attendu as (
  select * from (values
    ('Table', 'profiles'),
    ('Table', 'companies'),
    ('Table', 'company_contacts'),
    ('Table', 'company_channels'),
    ('Table', 'company_resources'),
    ('Table', 'company_documents'),
    ('Table', 'projects'),
    ('Table', 'tasks'),
    ('Table', 'time_entries'),
    ('Table', 'activity_logs'),
    ('Table', 'ai_requests'),
    ('Table', 'reports'),
    ('Table', 'report_attachments'),
    ('Table', 'report_deliveries'),
    ('Table', 'report_schedules'),
    ('Table', 'ai_conversations'),
    ('Table', 'ai_messages'),
    ('Table', 'company_memories')
  ) as t(genre, nom)
)
select
  a.genre,
  a.nom as element,
  case when c.relname is null then 'MANQUANT' else 'OK' end as etat,
  case
    when c.relname is null then '—'
    when c.relrowsecurity then 'RLS activée'
    else 'RLS DESACTIVEE'
  end as securite,
  coalesce((
    select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = a.nom
  ), 0) as politiques
from attendu a
left join pg_class c
  on c.relname = a.nom
 and c.relnamespace = 'public'::regnamespace
 and c.relkind = 'r'

union all

-- Bucket de stockage privé
select
  'Stockage',
  'bucket documents',
  case when b.id is null then 'MANQUANT' else 'OK' end,
  case
    when b.id is null then '—'
    when b.public then 'PUBLIC — A CORRIGER'
    else 'privé'
  end,
  (select count(*) from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname like 'documents_%')
from (select 1) x
left join storage.buckets b on b.id = 'documents'

order by 1, 2;
