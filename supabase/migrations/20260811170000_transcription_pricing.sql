-- MAW Pilot — Migration 7 : tarif de transcription vocale
--
-- La dictée est facturée séparément du texte. Pour que le compteur de budget
-- reste exact, on ajoute un tarif à la minute d'audio, modifiable comme les
-- autres (les tarifs OpenAI évoluent).

alter table public.ai_budget
  add column if not exists price_transcription_per_minute numeric(12, 4)
    not null default 0.006;

comment on column public.ai_budget.price_transcription_per_minute is
  'Coût en dollars d''une minute d''audio transcrit. À recopier depuis la '
  'page Tarifs d''OpenAI pour le modèle de transcription utilisé.';
