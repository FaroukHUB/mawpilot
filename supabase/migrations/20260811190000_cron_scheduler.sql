-- MAW Pilot — Migration 9 : planificateur serveur (pg_cron + pg_net + Vault)
--
-- POURQUOI CE CHOIX (voir docs/DECISIONS.md, D-021)
-- Le planificateur doit fonctionner APPLICATION FERMÉE. Deux options :
--   • Vercel Cron : limité à un déclenchement par jour sur l'offre gratuite,
--     donc incapable d'honorer « rappelle-moi vendredi à 15 h » ;
--   • pg_cron dans Supabase : la base tourne en permanence, indépendamment de
--     l'hébergeur de l'application. C'est l'option retenue.
--
-- Toutes les 5 minutes, pg_cron appelle /api/cron/tick via pg_net. La route
-- traite les échéances de façon idempotente.
--
-- ⚠ AVANT D'EXÉCUTER : remplacez les deux valeurs ci-dessous.
--   1. l'URL de votre application ;
--   2. le secret partagé (une longue chaîne aléatoire que vous générez).
-- Le même secret doit être ajouté chez votre hébergeur sous le nom CRON_SECRET.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- Secrets dans Supabase Vault (jamais en clair dans une table ni dans un job)
-- ---------------------------------------------------------------------------

do $$
declare
  -- ⬇⬇⬇ À PERSONNALISER ⬇⬇⬇
  v_app_url text := 'https://mawpilot-rose.vercel.app';
  v_cron_secret text := 'REMPLACEZ_PAR_UN_SECRET_LONG_ET_ALEATOIRE';
  -- ⬆⬆⬆ À PERSONNALISER ⬆⬆⬆
begin
  if v_cron_secret = 'REMPLACEZ_PAR_UN_SECRET_LONG_ET_ALEATOIRE' then
    raise exception
      'Personnalisez v_app_url et v_cron_secret avant d''exécuter cette migration.';
  end if;

  -- Remplace le secret s'il existe déjà (rotation possible sans erreur).
  perform vault.create_secret(v_app_url, 'mawpilot_app_url', 'URL publique de MAW Pilot')
    where not exists (select 1 from vault.secrets where name = 'mawpilot_app_url');

  perform vault.create_secret(v_cron_secret, 'mawpilot_cron_secret', 'Secret partagé du planificateur')
    where not exists (select 1 from vault.secrets where name = 'mawpilot_cron_secret');

  update vault.secrets set secret = v_app_url where name = 'mawpilot_app_url';
  update vault.secrets set secret = v_cron_secret where name = 'mawpilot_cron_secret';
end;
$$;

-- ---------------------------------------------------------------------------
-- Fonction appelée par le planificateur
-- ---------------------------------------------------------------------------

create or replace function public.trigger_mawpilot_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'mawpilot_app_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'mawpilot_cron_secret';

  if v_url is null or v_secret is null then
    raise warning 'Planificateur MAW Pilot : secrets absents du Vault.';
    return;
  end if;

  perform extensions.http_post(
    url := v_url || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

comment on function public.trigger_mawpilot_tick is
  'Appelle /api/cron/tick avec le secret stocké dans Vault. Exécutée toutes '
  'les 5 minutes par pg_cron, y compris application fermée.';

-- Personne d'autre que le planificateur ne doit pouvoir l'appeler.
revoke all on function public.trigger_mawpilot_tick() from public;
revoke all on function public.trigger_mawpilot_tick() from authenticated;
revoke all on function public.trigger_mawpilot_tick() from anon;

-- ---------------------------------------------------------------------------
-- Planification : toutes les 5 minutes
-- ---------------------------------------------------------------------------

-- Supprime une planification existante pour permettre de rejouer ce script.
select cron.unschedule('mawpilot-tick')
  where exists (select 1 from cron.job where jobname = 'mawpilot-tick');

select cron.schedule(
  'mawpilot-tick',
  '*/5 * * * *',
  $$ select public.trigger_mawpilot_tick(); $$
);

-- ---------------------------------------------------------------------------
-- Vérification
-- ---------------------------------------------------------------------------
-- Planification active :
--   select jobname, schedule, active from cron.job;
-- Dernières exécutions :
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'mawpilot-tick')
--    order by start_time desc limit 10;
