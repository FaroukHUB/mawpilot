-- MAW Pilot — Migration 10 : rappels et automatisations exécutables par la voix
--
-- Étend `execute_ai_actions` (migration 5) avec deux actions, pour que
-- « rappelle-moi vendredi à 15 h » et « chaque vendredi prépare le rapport »
-- s'exécutent dans la même transaction que le reste d'une dictée.
--
-- Le calcul de la première échéance des rappels récurrents est fait côté
-- application (fonctions testées de src/lib/automations/schedule.ts) et
-- transmis dans `next_run_at` : la base ne recalcule rien.

create or replace function public.execute_ai_actions(
  p_actions jsonb,
  p_request_id uuid default null,
  p_source public.activity_source default 'ia'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action jsonb;
  v_name text;
  v_args jsonb;
  v_results jsonb := '[]'::jsonb;

  v_company_id uuid;
  v_company_name text;
  v_project_id uuid;
  v_task_id uuid;
  v_task_title text;
  v_new_id uuid;
  v_minutes integer;
  v_total integer;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non authentifié.';
  end if;

  if jsonb_typeof(p_actions) <> 'array' then
    raise exception 'Format d''actions invalide.';
  end if;

  for v_action in select * from jsonb_array_elements(p_actions)
  loop
    v_name := v_action ->> 'name';
    v_args := coalesce(v_action -> 'arguments', '{}'::jsonb);
    v_company_id := null;
    v_company_name := null;

    if v_args ? 'company_id' and nullif(v_args ->> 'company_id', '') is not null then
      v_company_id := (v_args ->> 'company_id')::uuid;
      select name into v_company_name
        from companies
       where id = v_company_id and user_id = v_user_id;
      if v_company_name is null then
        raise exception 'Entreprise introuvable ou non autorisée (%).', v_company_id;
      end if;
    end if;

    if v_name = 'create_company' then
      insert into companies (user_id, name, color, contact_name, contact_email,
                             contact_phone, website, notes, monthly_amount,
                             included_services)
      values (v_user_id,
              v_args ->> 'name',
              coalesce(nullif(v_args ->> 'color', ''), '#FFA000'),
              nullif(v_args ->> 'contact_name', ''),
              nullif(v_args ->> 'contact_email', ''),
              nullif(v_args ->> 'contact_phone', ''),
              nullif(v_args ->> 'website', ''),
              nullif(v_args ->> 'notes', ''),
              nullif(v_args ->> 'monthly_amount', '')::numeric,
              nullif(v_args ->> 'included_services', ''))
      returning id into v_new_id;

      -- Cohérence des données (priorité 4 de l'audit) : un contact fourni à la
      -- création devient un vrai contact, pas seulement un texte sur la fiche.
      if nullif(v_args ->> 'contact_name', '') is not null then
        insert into company_contacts (user_id, company_id, name, email, phone,
                                      role, notes)
        values (v_user_id, v_new_id,
                v_args ->> 'contact_name',
                nullif(v_args ->> 'contact_email', ''),
                nullif(v_args ->> 'contact_phone', ''),
                'Contact principal',
                null);
      end if;

      -- Le site devient aussi un accès rapide, immédiatement ouvrable.
      if nullif(v_args ->> 'website', '') is not null then
        insert into company_resources (user_id, company_id, category, label,
                                       url, is_favorite)
        values (v_user_id, v_new_id, 'site_public',
                'Site — ' || (v_args ->> 'name'),
                v_args ->> 'website', true);
      end if;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_new_id, 'entreprise_creee',
              format('Entreprise « %s » créée par l''assistant.', v_args ->> 'name'),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Entreprise « %s » créée.', v_args ->> 'name'));

    elsif v_name = 'create_project' then
      insert into projects (user_id, company_id, name, description, status)
      values (v_user_id, v_company_id,
              v_args ->> 'name',
              nullif(v_args ->> 'description', ''),
              coalesce(nullif(v_args ->> 'status', ''), 'actif')::project_status)
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, project_id, action_type,
                                 description, after_data, source)
      values (v_user_id, v_company_id, v_new_id, 'projet_cree',
              format('Projet « %s » créé pour %s par l''assistant.',
                     v_args ->> 'name', v_company_name),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Projet « %s » créé.', v_args ->> 'name'));

    elsif v_name = 'create_task' then
      v_project_id := nullif(v_args ->> 'project_id', '')::uuid;
      if v_project_id is not null then
        perform 1 from projects
         where id = v_project_id and company_id = v_company_id and user_id = v_user_id;
        if not found then
          raise exception 'Projet introuvable pour cette entreprise.';
        end if;
      end if;

      insert into tasks (user_id, company_id, project_id, title, description,
                         category, status, priority, due_date,
                         estimated_minutes, billing_status, amount, source,
                         completed_at)
      values (v_user_id, v_company_id, v_project_id,
              v_args ->> 'title',
              nullif(v_args ->> 'description', ''),
              coalesce(nullif(v_args ->> 'category', ''), 'autre')::task_category,
              coalesce(nullif(v_args ->> 'status', ''), 'a_faire')::task_status,
              coalesce(nullif(v_args ->> 'priority', ''), 'normale')::task_priority,
              nullif(v_args ->> 'due_date', '')::date,
              nullif(v_args ->> 'estimated_minutes', '')::integer,
              coalesce(nullif(v_args ->> 'billing_status', ''), 'incluse')::billing_status,
              nullif(v_args ->> 'amount', '')::numeric,
              coalesce(nullif(v_args ->> 'source', ''), 'ia_texte')::creation_source,
              case when nullif(v_args ->> 'status', '') = 'terminee'
                   then now() else null end)
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, project_id, task_id,
                                 action_type, description, after_data, source)
      values (v_user_id, v_company_id, v_project_id, v_new_id, 'tache_creee',
              format('Tâche « %s » créée pour %s par l''assistant.',
                     v_args ->> 'title', v_company_name),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Tâche « %s » créée.', v_args ->> 'title'));

    elsif v_name in ('update_task', 'complete_task', 'reopen_task') then
      v_task_id := (v_args ->> 'task_id')::uuid;
      select title, company_id into v_task_title, v_company_id
        from tasks
       where id = v_task_id and user_id = v_user_id;
      if v_task_title is null then
        raise exception 'Tâche introuvable ou non autorisée.';
      end if;

      if v_name = 'complete_task' then
        update tasks
           set status = 'terminee', completed_at = now()
         where id = v_task_id and user_id = v_user_id;
        v_label := format('Tâche « %s » terminée.', v_task_title);
      elsif v_name = 'reopen_task' then
        update tasks
           set status = coalesce(nullif(v_args ->> 'status', ''), 'a_faire')::task_status,
               completed_at = null
         where id = v_task_id and user_id = v_user_id;
        v_label := format('Tâche « %s » rouverte.', v_task_title);
      else
        update tasks
           set title = coalesce(nullif(v_args ->> 'title', ''), title),
               description = coalesce(nullif(v_args ->> 'description', ''), description),
               category = coalesce(nullif(v_args ->> 'category', '')::task_category, category),
               status = coalesce(nullif(v_args ->> 'status', '')::task_status, status),
               priority = coalesce(nullif(v_args ->> 'priority', '')::task_priority, priority),
               due_date = coalesce(nullif(v_args ->> 'due_date', '')::date, due_date),
               estimated_minutes = coalesce(nullif(v_args ->> 'estimated_minutes', '')::integer, estimated_minutes),
               billing_status = coalesce(nullif(v_args ->> 'billing_status', '')::billing_status, billing_status),
               amount = coalesce(nullif(v_args ->> 'amount', '')::numeric, amount),
               completed_at = case
                 when nullif(v_args ->> 'status', '') = 'terminee' then now()
                 when nullif(v_args ->> 'status', '') is not null then null
                 else completed_at end
         where id = v_task_id and user_id = v_user_id;
        v_label := format('Tâche « %s » modifiée.', v_task_title);
      end if;

      insert into activity_logs (user_id, company_id, task_id, action_type,
                                 description, after_data, source)
      values (v_user_id, v_company_id, v_task_id, v_name, v_label, v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_task_id, 'description', v_label);

    elsif v_name = 'log_time' then
      v_minutes := (v_args ->> 'minutes')::integer;
      if v_minutes is null or v_minutes <= 0 then
        raise exception 'Durée invalide.';
      end if;

      v_task_id := nullif(v_args ->> 'task_id', '')::uuid;
      if v_task_id is not null then
        select title into v_task_title
          from tasks
         where id = v_task_id and company_id = v_company_id and user_id = v_user_id;
        if v_task_title is null then
          raise exception 'Tâche introuvable pour cette entreprise.';
        end if;
      end if;

      insert into time_entries (user_id, company_id, task_id, minutes,
                                entry_date, description, is_billable)
      values (v_user_id, v_company_id, v_task_id, v_minutes,
              coalesce(nullif(v_args ->> 'entry_date', '')::date, current_date),
              nullif(v_args ->> 'description', ''),
              coalesce((v_args ->> 'is_billable')::boolean, false))
      returning id into v_new_id;

      if v_task_id is not null then
        select coalesce(sum(minutes), 0) into v_total
          from time_entries where task_id = v_task_id;
        update tasks set actual_minutes = v_total
         where id = v_task_id and user_id = v_user_id;
      end if;

      v_label := format('%s min enregistrées pour %s%s.',
                        v_minutes, v_company_name,
                        coalesce(' sur « ' || v_task_title || ' »', ''));

      insert into activity_logs (user_id, company_id, task_id, action_type,
                                 description, after_data, source)
      values (v_user_id, v_company_id, v_task_id, 'temps_enregistre',
              v_label, v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id, 'description', v_label);

    elsif v_name = 'add_company_resource' then
      insert into company_resources (user_id, company_id, category, label, url,
                                     description, login_hint, is_favorite)
      values (v_user_id, v_company_id,
              coalesce(nullif(v_args ->> 'category', ''), 'autre')::resource_category,
              v_args ->> 'label',
              v_args ->> 'url',
              nullif(v_args ->> 'description', ''),
              nullif(v_args ->> 'login_hint', ''),
              coalesce((v_args ->> 'is_favorite')::boolean, false))
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_company_id, 'ressource_creee',
              format('Accès rapide « %s » ajouté pour %s par l''assistant.',
                     v_args ->> 'label', v_company_name),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Accès rapide « %s » ajouté.', v_args ->> 'label'));

    elsif v_name = 'save_company_memory' then
      insert into company_memories (user_id, company_id, content, category,
                                    source, status)
      values (v_user_id, v_company_id,
              v_args ->> 'content',
              coalesce(nullif(v_args ->> 'category', ''), 'autre')::memory_category,
              coalesce(nullif(v_args ->> 'source', ''), 'ia_confirmee')::memory_source,
              coalesce(nullif(v_args ->> 'status', ''), 'confirmee')::memory_status)
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_company_id, 'memoire_enregistree',
              format('Information retenue pour %s : « %s »',
                     v_company_name, left(v_args ->> 'content', 120)),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Information retenue : « %s »',
                              left(v_args ->> 'content', 120)));

    elsif v_name = 'attach_company_document' then
      insert into company_documents (user_id, company_id, name, description,
                                     type, external_url)
      values (v_user_id, v_company_id,
              v_args ->> 'name',
              nullif(v_args ->> 'description', ''),
              'lien_externe',
              v_args ->> 'external_url')
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_company_id, 'document_ajoute',
              format('Lien « %s » ajouté aux documents de %s par l''assistant.',
                     v_args ->> 'name', v_company_name),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Lien « %s » ajouté.', v_args ->> 'name'));

    -- ---------------------------------------------------------------------
    -- NOUVEAU : rappels et automatisations
    -- ---------------------------------------------------------------------
    elsif v_name = 'create_reminder' then
      if nullif(v_args ->> 'next_run_at', '') is null then
        raise exception 'Échéance du rappel absente.';
      end if;

      insert into reminders (user_id, company_id, title, body, frequency,
                             next_run_at, time_of_day, timezone,
                             day_of_week, day_of_month, source)
      values (v_user_id, v_company_id,
              v_args ->> 'title',
              nullif(v_args ->> 'body', ''),
              coalesce(nullif(v_args ->> 'frequency', ''), 'ponctuel')::reminder_frequency,
              (v_args ->> 'next_run_at')::timestamptz,
              coalesce(nullif(v_args ->> 'time_of_day', ''), '09:00')::time,
              coalesce(nullif(v_args ->> 'timezone', ''), 'Europe/Paris'),
              nullif(v_args ->> 'day_of_week', '')::integer,
              nullif(v_args ->> 'day_of_month', '')::integer,
              'ia_voix')
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_company_id, 'rappel_cree',
              format('Rappel « %s » programmé par l''assistant.', v_args ->> 'title'),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Rappel « %s » programmé.', v_args ->> 'title'));

    elsif v_name = 'create_automation_rule' then
      insert into automation_rules (user_id, company_id, kind, frequency,
                                    time_of_day, timezone, day_of_week,
                                    day_of_month, params)
      values (v_user_id, v_company_id,
              (v_args ->> 'kind')::automation_kind,
              coalesce(nullif(v_args ->> 'frequency', ''), 'quotidien')::reminder_frequency,
              coalesce(nullif(v_args ->> 'time_of_day', ''), '08:00')::time,
              coalesce(nullif(v_args ->> 'timezone', ''), 'Europe/Paris'),
              nullif(v_args ->> 'day_of_week', '')::integer,
              nullif(v_args ->> 'day_of_month', '')::integer,
              coalesce(v_args -> 'params', '{}'::jsonb))
      returning id into v_new_id;

      insert into activity_logs (user_id, company_id, action_type, description,
                                 after_data, source)
      values (v_user_id, v_company_id, 'automatisation_creee',
              format('Automatisation « %s » activée par l''assistant.',
                     v_args ->> 'kind'),
              v_args, p_source);

      v_results := v_results || jsonb_build_object(
        'name', v_name, 'id', v_new_id,
        'description', format('Automatisation « %s » activée.', v_args ->> 'kind'));

    else
      raise exception 'Action inconnue ou non autorisée : %.', v_name;
    end if;
  end loop;

  if p_request_id is not null then
    update ai_requests
       set status = 'executee', result = v_results
     where id = p_request_id and user_id = v_user_id;
  end if;

  return v_results;
end;
$$;

comment on function public.execute_ai_actions is
  'Exécute en une transaction les actions confirmées par l''utilisateur. '
  'Tout réussit ou tout est annulé. RLS appliquée (pas de security definer). '
  'Crée aussi le contact principal et l''accès rapide du site à la création '
  'd''une entreprise (cohérence des données).';
