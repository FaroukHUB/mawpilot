import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";

import {
  ClientRequestQueue,
  type RequestAttachment,
} from "@/components/client-portal/client-request-queue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Demandes clients" };

export default async function ClientRequestsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("client_requests")
    .select("*, companies(name, color)")
    .neq("status", "archivee")
    .order("created_at", { ascending: false })
    .limit(60);

  const raw = requests ?? [];

  // Pièces jointes déposées par les clients : signées pour être ouvertes
  // directement depuis la file, sans passer par la fiche entreprise.
  const { data: files } = await supabase
    .from("client_attachments")
    .select("id, name, mime_type, storage_path, request_id")
    .in(
      "request_id",
      raw.map((r) => r.id)
    )
    .limit(200);

  const byRequest = new Map<string, RequestAttachment[]>();
  for (const file of files ?? []) {
    if (!file.request_id) continue;
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(file.storage_path, 60 * 30);
    const entry: RequestAttachment = {
      id: file.id,
      name: file.name,
      url: signed?.signedUrl ?? null,
      isImage: String(file.mime_type).startsWith("image/"),
    };
    const existing = byRequest.get(file.request_id);
    if (existing) existing.push(entry);
    else byRequest.set(file.request_id, [entry]);
  }

  const list = raw.map((request) => ({
    ...request,
    attachments: byRequest.get(request.id) ?? [],
  }));
  const pending = list.filter(
    (r) => r.status === "nouvelle" || r.status === "en_analyse"
  );
  const outOfScope = list.filter((r) => r.status === "hors_forfait");
  const handled = list.filter(
    (r) => r.status === "acceptee" || r.status === "refusee"
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Demandes clients</h1>

      {list.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <Inbox
              className="mx-auto mb-2 size-8 text-muted-foreground"
              aria-hidden
            />
            <CardTitle>Aucune demande</CardTitle>
            <CardDescription>
              Créez un lien de suivi depuis la fiche d&apos;une entreprise
              (onglet « Portail client ») et envoyez-le à votre contact.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {outOfScope.length > 0 ? (
        <Card className="border-brand-orange">
          <CardHeader>
            <CardTitle className="text-base">
              Hors forfait — à arbitrer ({outOfScope.length})
            </CardTitle>
            <CardDescription>
              Le client a déjà reçu votre message d&apos;attente. À vous de
              décider : devis, geste commercial, ou refus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientRequestQueue requests={outOfScope} />
          </CardContent>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              À traiter ({pending.length})
            </CardTitle>
            <CardDescription>
              Aucune date n&apos;a été communiquée au client : c&apos;est vous
              qui vous engagez, ici.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientRequestQueue requests={pending} />
          </CardContent>
        </Card>
      ) : null}

      {handled.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Traitées</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientRequestQueue requests={handled} readOnly />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
