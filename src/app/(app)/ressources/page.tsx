import type { Metadata } from "next";
import Link from "next/link";

import { ResourcesPanel } from "@/components/resources/resources-panel";
import type { ResourceRow } from "@/components/resources/resource-form-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accès rapides" };

export default async function ResourcesPage({
  searchParams,
}: PageProps<"/ressources">) {
  const params = await searchParams;
  const selected =
    typeof params.entreprise === "string" ? params.entreprise : "";

  const supabase = await createClient();
  const [{ data: companies }, { data: resources }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("company_resources")
      .select()
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  const companyList = companies ?? [];
  const allResources = (resources ?? []) as ResourceRow[];
  const activeCompanyId = selected || companyList[0]?.id;
  const companyResources = allResources.filter(
    (r) => r.company_id === activeCompanyId
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Accès rapides</h1>

      {companyList.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Aucune entreprise</CardTitle>
            <CardDescription>
              Créez d&apos;abord une entreprise pour y enregistrer ses accès.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <nav aria-label="Choisir une entreprise" className="overflow-x-auto">
            <ul className="flex gap-1 border-b">
              {companyList.map((c) => (
                <li key={c.id} className="shrink-0">
                  <Link
                    href={`/ressources?entreprise=${c.id}`}
                    aria-current={activeCompanyId === c.id ? "page" : undefined}
                    className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      activeCompanyId === c.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {activeCompanyId ? (
            <ResourcesPanel
              companyId={activeCompanyId}
              resources={companyResources}
            />
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Sélectionnez une entreprise.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
