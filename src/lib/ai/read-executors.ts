import type { SupabaseClient } from "@supabase/supabase-js";

import { formatMinutes, todayISODate } from "@/lib/dates";
import type { ReadFunctionName } from "@/lib/ai/functions";

/**
 * Exécuteurs des fonctions de LECTURE.
 * Chaque requête filtre explicitement sur `user_id` : l'IA ne peut jamais
 * accéder aux données d'un autre compte, même si elle inventait un identifiant.
 * Les résultats sont volontairement compacts (limitation des coûts, D-013).
 */
export async function executeReadFunction(
  supabase: SupabaseClient,
  userId: string,
  name: ReadFunctionName,
  args: Record<string, unknown>
): Promise<unknown> {
  const companyId = args.company_id as string | undefined;
  const limit = (args.limit as number | undefined) ?? 20;

  switch (name) {
    case "search_tasks": {
      let query = supabase
        .from("tasks")
        .select(
          "id, title, status, priority, category, billing_status, amount, due_date, actual_minutes, companies(name), projects(name)"
        )
        .eq("user_id", userId)
        .neq("status", "archivee")
        .limit(limit);

      if (companyId) query = query.eq("company_id", companyId);
      if (args.status) query = query.eq("status", args.status as string);
      if (args.priority) query = query.eq("priority", args.priority as string);
      if (args.billing_status)
        query = query.eq("billing_status", args.billing_status as string);
      if (args.due_before)
        query = query.lte("due_date", args.due_before as string);
      if (args.due_after) query = query.gte("due_date", args.due_after as string);
      if (args.query) query = query.ilike("title", `%${args.query as string}%`);

      const { data } = await query;
      return (data ?? []).map((t) => ({
        id: t.id,
        titre: t.title,
        entreprise: (t.companies as { name?: string } | null)?.name,
        projet: (t.projects as { name?: string } | null)?.name,
        statut: t.status,
        priorite: t.priority,
        categorie: t.category,
        facturation: t.billing_status,
        montant: t.amount,
        echeance: t.due_date,
        temps: t.actual_minutes ? formatMinutes(t.actual_minutes) : null,
      }));
    }

    case "get_company_summary": {
      const start = (args.period_start as string) ?? null;
      const end = (args.period_end as string) ?? null;

      const { data: company } = await supabase
        .from("companies")
        .select("id, name, monthly_amount, included_services, notes")
        .eq("id", companyId!)
        .eq("user_id", userId)
        .single();
      if (!company) return { erreur: "Entreprise introuvable." };

      let timeQuery = supabase
        .from("time_entries")
        .select("minutes, is_billable")
        .eq("company_id", company.id)
        .eq("user_id", userId);
      if (start) timeQuery = timeQuery.gte("entry_date", start);
      if (end) timeQuery = timeQuery.lte("entry_date", end);

      const [{ data: tasks }, { data: times }] = await Promise.all([
        supabase
          .from("tasks")
          .select("status, billing_status, amount, completed_at")
          .eq("company_id", company.id)
          .eq("user_id", userId)
          .neq("status", "archivee"),
        timeQuery,
      ]);

      const list = tasks ?? [];
      const completed = list.filter(
        (t) =>
          t.status === "terminee" &&
          (!start || (t.completed_at ?? "") >= start) &&
          (!end || (t.completed_at ?? "") <= `${end}T23:59:59Z`)
      );
      const unbilled = list.filter(
        (t) =>
          t.billing_status === "a_facturer" ||
          t.billing_status === "supplementaire"
      );
      const totalMinutes = (times ?? []).reduce((s, e) => s + e.minutes, 0);

      return {
        entreprise: company.name,
        forfait_mensuel: company.monthly_amount,
        prestations_incluses: company.included_services,
        taches_terminees: completed.length,
        taches_ouvertes: list.filter((t) => t.status !== "terminee").length,
        en_attente_client: list.filter((t) => t.status === "en_attente_client")
          .length,
        bloquees: list.filter((t) => t.status === "bloquee").length,
        temps_passe: formatMinutes(totalMinutes),
        a_facturer_nombre: unbilled.length,
        a_facturer_montant: unbilled.reduce((s, t) => s + (t.amount ?? 0), 0),
      };
    }

    case "get_overdue_tasks": {
      let query = supabase
        .from("tasks")
        .select("id, title, due_date, priority, companies(name)")
        .eq("user_id", userId)
        .lt("due_date", todayISODate())
        .not("status", "in", "(terminee,archivee)")
        .order("due_date")
        .limit(50);
      if (companyId) query = query.eq("company_id", companyId);

      const { data } = await query;
      return (data ?? []).map((t) => ({
        id: t.id,
        titre: t.title,
        entreprise: (t.companies as { name?: string } | null)?.name,
        echeance: t.due_date,
        priorite: t.priority,
      }));
    }

    case "get_unbilled_work": {
      let query = supabase
        .from("tasks")
        .select("id, title, billing_status, amount, actual_minutes, companies(name)")
        .eq("user_id", userId)
        .in("billing_status", ["a_facturer", "supplementaire"])
        .neq("status", "archivee")
        .limit(50);
      if (companyId) query = query.eq("company_id", companyId);

      const { data } = await query;
      const rows = (data ?? []).map((t) => ({
        id: t.id,
        titre: t.title,
        entreprise: (t.companies as { name?: string } | null)?.name,
        facturation: t.billing_status,
        montant: t.amount,
        temps: t.actual_minutes ? formatMinutes(t.actual_minutes) : null,
      }));
      return {
        prestations: rows,
        total: rows.reduce((s, r) => s + (r.montant ?? 0), 0),
      };
    }

    case "search_activity": {
      let query = supabase
        .from("activity_logs")
        .select("description, created_at, companies(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (companyId) query = query.eq("company_id", companyId);
      if (args.since) query = query.gte("created_at", args.since as string);

      const { data } = await query;
      return (data ?? []).map((l) => ({
        description: l.description,
        date: l.created_at,
        entreprise: (l.companies as { name?: string } | null)?.name,
      }));
    }

    case "search_reports": {
      let query = supabase
        .from("reports")
        .select("id, title, type, status, period_start, period_end, companies(name)")
        .eq("user_id", userId)
        .order("period_end", { ascending: false })
        .limit(limit);
      if (companyId) query = query.eq("company_id", companyId);

      const { data } = await query;
      return (data ?? []).map((r) => ({
        id: r.id,
        titre: r.title,
        entreprise: (r.companies as { name?: string } | null)?.name,
        type: r.type,
        statut: r.status,
        periode: `${r.period_start} → ${r.period_end}`,
      }));
    }

    case "search_documents": {
      let query = supabase
        .from("company_documents")
        .select("id, name, type, external_url, created_at, companies(name)")
        .eq("user_id", userId)
        .eq("status", "actif")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (companyId) query = query.eq("company_id", companyId);
      if (args.query) query = query.ilike("name", `%${args.query as string}%`);

      const { data } = await query;
      return (data ?? []).map((d) => ({
        id: d.id,
        nom: d.name,
        entreprise: (d.companies as { name?: string } | null)?.name,
        type: d.type,
        url: d.external_url,
      }));
    }

    case "search_company_resources": {
      let query = supabase
        .from("company_resources")
        .select("id, label, url, category, is_favorite, companies(name)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(50);
      if (companyId) query = query.eq("company_id", companyId);
      if (args.category) query = query.eq("category", args.category as string);
      if (args.query) query = query.ilike("label", `%${args.query as string}%`);

      const { data } = await query;
      return (data ?? []).map((r) => ({
        id: r.id,
        libelle: r.label,
        url: r.url,
        categorie: r.category,
        favori: r.is_favorite,
        entreprise: (r.companies as { name?: string } | null)?.name,
      }));
    }

    case "search_company_memories": {
      let query = supabase
        .from("company_memories")
        .select("id, content, category, source, status")
        .eq("user_id", userId)
        .eq("company_id", companyId!)
        .eq("is_archived", false)
        .limit(50);
      if (args.query) query = query.ilike("content", `%${args.query as string}%`);

      const { data } = await query;
      return (data ?? []).map((m) => ({
        id: m.id,
        information: m.content,
        categorie: m.category,
        source: m.source,
        statut: m.status,
      }));
    }

    default:
      return { erreur: "Fonction de lecture inconnue." };
  }
}
