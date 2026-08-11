"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Star,
} from "lucide-react";

import {
  moveResource,
  setResourceActive,
  toggleResourceFavorite,
} from "@/actions/resources";
import {
  ResourceFormDialog,
  type ResourceRow,
} from "@/components/resources/resource-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  resourceCategoryLabels,
  resourceGroups,
} from "@/lib/validations/resources";
import { cn } from "@/lib/utils";

export function ResourcesPanel({
  companyId,
  resources,
  showArchived = false,
}: {
  companyId: string;
  resources: ResourceRow[];
  showArchived?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const visible = resources.filter((r) => (showArchived ? true : r.is_active));
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? visible.filter(
        (r) =>
          r.label.toLowerCase().includes(normalizedQuery) ||
          r.url.toLowerCase().includes(normalizedQuery) ||
          (r.description ?? "").toLowerCase().includes(normalizedQuery) ||
          resourceCategoryLabels[r.category]
            .toLowerCase()
            .includes(normalizedQuery)
      )
    : visible;

  const favorites = filtered.filter((r) => r.is_favorite);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un accès…"
            aria-label="Rechercher un accès rapide"
            className="pl-9"
          />
        </div>
        <ResourceFormDialog companyId={companyId}>
          <Button size="sm">
            <Plus aria-hidden />
            Accès rapide
          </Button>
        </ResourceFormDialog>
      </div>

      {resources.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aucun accès rapide. Ajoutez le site, l&apos;administration, la
            Search Console, les réseaux sociaux… tout ce que vous ouvrez
            régulièrement pour ce client.
          </CardContent>
        </Card>
      ) : null}

      {favorites.length > 0 ? (
        <section aria-label="Favoris" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Star className="size-3.5 fill-brand-yellow text-brand-yellow" aria-hidden />
            Favoris
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                companyId={companyId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ))}
          </div>
        </section>
      ) : null}

      {resourceGroups.map((group) => {
        const groupResources = filtered.filter((r) =>
          group.categories.includes(r.category)
        );
        if (groupResources.length === 0) return null;
        return (
          <section
            key={group.label}
            aria-label={group.label}
            className="flex flex-col gap-2"
          >
            <h3 className="text-sm font-semibold text-muted-foreground">
              {group.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groupResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  companyId={companyId}
                  isPending={isPending}
                  startTransition={startTransition}
                  reorderable
                />
              ))}
            </div>
          </section>
        );
      })}

      {normalizedQuery && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun accès ne correspond à « {query} ».
        </p>
      ) : null}
    </div>
  );
}

function ResourceCard({
  resource,
  companyId,
  isPending,
  startTransition,
  reorderable = false,
}: {
  resource: ResourceRow;
  companyId: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  reorderable?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-2 py-3 transition-shadow hover:shadow-md",
        !resource.is_active && "opacity-60"
      )}
    >
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{resource.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {resourceCategoryLabels[resource.category]}
            </p>
          </div>
          {!resource.is_active ? (
            <Badge variant="secondary">Archivé</Badge>
          ) : null}
        </div>

        {resource.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {resource.description}
          </p>
        ) : null}

        {resource.login_hint ? (
          <p className="truncate text-xs text-muted-foreground">
            Identifiant : {resource.login_hint}
          </p>
        ) : null}
        {resource.password_manager_ref ? (
          <p className="truncate text-xs text-muted-foreground">
            Coffre : {resource.password_manager_ref}
          </p>
        ) : null}

        <div className="flex items-center gap-1">
          <Button size="sm" className="flex-1" asChild>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Ouvrir
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={
              resource.is_favorite
                ? `Retirer ${resource.label} des favoris`
                : `Ajouter ${resource.label} aux favoris`
            }
            onClick={() =>
              startTransition(async () => {
                await toggleResourceFavorite(resource.id, !resource.is_favorite);
              })
            }
          >
            <Star
              className={cn(
                resource.is_favorite && "fill-brand-yellow text-brand-yellow"
              )}
              aria-hidden
            />
          </Button>
          {reorderable ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={`Monter ${resource.label}`}
                onClick={() =>
                  startTransition(async () => {
                    await moveResource(resource.id, "up");
                  })
                }
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={`Descendre ${resource.label}`}
                onClick={() =>
                  startTransition(async () => {
                    await moveResource(resource.id, "down");
                  })
                }
              >
                <ChevronDown aria-hidden />
              </Button>
            </>
          ) : null}
          <ResourceFormDialog companyId={companyId} resource={resource}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Modifier ${resource.label}`}
            >
              <Pencil aria-hidden />
            </Button>
          </ResourceFormDialog>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={
              resource.is_active
                ? `Archiver ${resource.label}`
                : `Réactiver ${resource.label}`
            }
            onClick={() =>
              startTransition(async () => {
                await setResourceActive(resource.id, !resource.is_active);
              })
            }
          >
            {resource.is_active ? (
              <Archive aria-hidden />
            ) : (
              <ArchiveRestore aria-hidden />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
