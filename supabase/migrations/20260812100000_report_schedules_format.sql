-- MAW Pilot — Migration 12 : format préféré des rapports planifiés
--
-- `report_schedules` existait depuis la migration 1 mais n'avait pas
-- d'interface. Elle devient la configuration de référence des rapports par
-- entreprise : fréquence, jour, heure, destination, sections et format.
--
-- Le déclenchement, lui, reste assuré par `automation_rules` (kind =
-- 'rapport_hebdo') pour n'avoir QU'UN seul chemin de planification.
-- Enregistrer une configuration synchronise automatiquement la règle
-- correspondante — voir src/actions/report-schedules.ts.

alter table public.report_schedules
  add column if not exists default_format text not null default 'whatsapp';

comment on column public.report_schedules.default_format is
  'Format préparé en priorité : whatsapp, pdf, docx ou xlsx.';

-- Une seule configuration par entreprise : la contrainte évite les doublons
-- silencieux et permet un upsert propre depuis l''application.
create unique index if not exists report_schedules_one_per_company
  on public.report_schedules (company_id);
