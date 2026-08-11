import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/database";

export const metadata: Metadata = { title: "Entreprises" };

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select()
    .order("is_active", { ascending: false })
    .order("name");

  const list = (companies ?? []) as Company[];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Entreprises</h1>
        <CompanyFormDialog>
          <Button>
            <Plus aria-hidden />
            Ajouter
          </Button>
        </CompanyFormDialog>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <Building2 className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
            <CardTitle>Aucune entreprise pour l&apos;instant</CardTitle>
            <CardDescription>
              Commence par ajouter ta première entreprise cliente avec le
              bouton « Ajouter ».
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((company) => (
            <Link
              key={company.id}
              href={`/entreprises/${company.id}`}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full gap-3 py-4 transition-shadow group-hover:shadow-md">
                <CardHeader className="px-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: company.color }}
                      aria-hidden
                    />
                    <CardTitle className="truncate">{company.name}</CardTitle>
                    {!company.is_active ? (
                      <Badge variant="secondary">Archivée</Badge>
                    ) : null}
                  </div>
                  {company.contact_name ? (
                    <CardDescription className="truncate">
                      {company.contact_name}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="px-4 text-sm text-muted-foreground">
                  {company.monthly_amount !== null
                    ? `Forfait mensuel : ${company.monthly_amount} €`
                    : "Pas de forfait mensuel renseigné"}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
