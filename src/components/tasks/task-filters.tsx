"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  BILLING_STATUSES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/enums";
import {
  billingStatusLabels,
  taskCategoryLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";

const PERIODS = [
  { value: "retard", label: "En retard" },
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "semaine", label: "Cette semaine" },
  { value: "mois", label: "Ce mois" },
] as const;

export function TaskFilters({
  companies,
  projects,
}: {
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; company_id: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (key: string) => searchParams.get(key) ?? "";
  const selectedCompany = current("entreprise");
  const companyProjects = selectedCompany
    ? projects.filter((p) => p.company_id === selectedCompany)
    : projects;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key === "entreprise") params.delete("projet");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasFilters = [
    "entreprise",
    "projet",
    "statut",
    "priorite",
    "categorie",
    "facturation",
    "periode",
  ].some((k) => current(k) !== "");

  const view = current("vue") === "kanban" ? "kanban" : "liste";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Filtrer par entreprise"
        className="w-auto"
        value={selectedCompany}
        onChange={(e) => setParam("entreprise", e.target.value)}
      >
        <option value="">Toutes les entreprises</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par projet"
        className="w-auto"
        value={current("projet")}
        onChange={(e) => setParam("projet", e.target.value)}
      >
        <option value="">Tous les projets</option>
        {companyProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par statut"
        className="w-auto"
        value={current("statut")}
        onChange={(e) => setParam("statut", e.target.value)}
      >
        <option value="">Tous les statuts</option>
        {TASK_STATUSES.filter((s) => s !== "archivee").map((s) => (
          <option key={s} value={s}>
            {taskStatusLabels[s]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par priorité"
        className="w-auto"
        value={current("priorite")}
        onChange={(e) => setParam("priorite", e.target.value)}
      >
        <option value="">Toutes priorités</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {taskPriorityLabels[p]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par catégorie"
        className="w-auto"
        value={current("categorie")}
        onChange={(e) => setParam("categorie", e.target.value)}
      >
        <option value="">Toutes catégories</option>
        {TASK_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {taskCategoryLabels[c]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par facturation"
        className="w-auto"
        value={current("facturation")}
        onChange={(e) => setParam("facturation", e.target.value)}
      >
        <option value="">Toute facturation</option>
        {BILLING_STATUSES.map((b) => (
          <option key={b} value={b}>
            {billingStatusLabels[b]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrer par période"
        className="w-auto"
        value={current("periode")}
        onChange={(e) => setParam("periode", e.target.value)}
      >
        <option value="">Toute période</option>
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <X aria-hidden />
          Effacer
        </Button>
      ) : null}
      <div className="ml-auto flex rounded-md border">
        <Button
          variant={view === "liste" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-r-none"
          onClick={() => setParam("vue", "")}
          aria-pressed={view === "liste"}
        >
          <List aria-hidden />
          Liste
        </Button>
        <Button
          variant={view === "kanban" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-l-none"
          onClick={() => setParam("vue", "kanban")}
          aria-pressed={view === "kanban"}
        >
          <Columns3 aria-hidden />
          Kanban
        </Button>
      </div>
    </div>
  );
}
