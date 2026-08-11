import type { Metadata } from "next";
import Link from "next/link";

import {
  DocumentsPanel,
  type DocumentRow,
} from "@/components/documents/documents-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({
  searchParams,
}: PageProps<"/documents">) {
  const params = await searchParams;
  const selected =
    typeof params.entreprise === "string" ? params.entreprise : "";

  const supabase = await createClient();

  let query = supabase
    .from("company_documents")
    .select("*, companies(name, color)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (selected) query = query.eq("company_id", selected);

  const [{ data: documents }, { data: companies }] = await Promise.all([
    query,
    supabase
      .from("companies")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name"),
  ]);

  const companyList = companies ?? [];
  const documentList = (documents ?? []) as unknown as DocumentRow[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Documents</h1>

      {companyList.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Aucune entreprise</CardTitle>
            <CardDescription>
              Créez d&apos;abord une entreprise pour y rattacher des documents.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <nav aria-label="Filtrer par entreprise" className="overflow-x-auto">
            <ul className="flex gap-1 border-b">
              <li className="shrink-0">
                <Link
                  href="/documents"
                  aria-current={!selected ? "page" : undefined}
                  className={`inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    !selected
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tous
                </Link>
              </li>
              {companyList.map((c) => (
                <li key={c.id} className="shrink-0">
                  <Link
                    href={`/documents?entreprise=${c.id}`}
                    aria-current={selected === c.id ? "page" : undefined}
                    className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      selected === c.id
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

          <DocumentsPanel
            companyId={selected || undefined}
            documents={documentList}
            showCompany={!selected}
          />
          {!selected ? (
            <Card>
              <CardContent className="py-4 text-sm text-muted-foreground">
                Choisissez une entreprise ci-dessus pour ajouter un fichier ou
                un lien.
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
