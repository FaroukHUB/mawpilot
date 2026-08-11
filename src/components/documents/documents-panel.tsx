"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import {
  Archive,
  ArchiveRestore,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import {
  createDocumentLink,
  deleteDocument,
  getDocumentSignedUrl,
  setDocumentArchived,
  uploadDocument,
} from "@/actions/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort } from "@/lib/dates";
import {
  documentTypeLabels,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  type DocumentType,
} from "@/lib/validations/documents";
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: DocumentType;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  document_date: string | null;
  status: "actif" | "archive";
  created_at: string;
  companies?: { name: string; color: string } | null;
};

export function DocumentsPanel({
  companyId,
  documents,
  showCompany = false,
}: {
  companyId?: string;
  documents: DocumentRow[];
  showCompany?: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const active = documents.filter((d) => d.status === "actif");
  const archived = documents.filter((d) => d.status === "archive");

  async function openFile(documentId: string) {
    setError(null);
    const result = await getDocumentSignedUrl(documentId);
    if (result.error || !result.data) {
      setError(result.error ?? "Lien de téléchargement indisponible.");
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      {companyId ? (
        <div className="flex flex-wrap gap-2">
          <UploadDialog companyId={companyId}>
            <Button size="sm">
              <Upload aria-hidden />
              Téléverser un fichier
            </Button>
          </UploadDialog>
          <LinkDialog companyId={companyId}>
            <Button size="sm" variant="outline">
              <Link2 aria-hidden />
              Ajouter un lien
            </Button>
          </LinkDialog>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Aucun document. Téléversez un livrable ou ajoutez le lien d&apos;un
            document existant.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {[...active, ...archived].map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
                doc.status === "archive" && "opacity-60"
              )}
            >
              {doc.type === "lien_externe" ? (
                <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {showCompany && doc.companies ? `${doc.companies.name} · ` : ""}
                  {documentTypeLabels[doc.type]}
                  {doc.size_bytes ? ` · ${formatFileSize(doc.size_bytes)}` : ""}
                  {doc.document_date
                    ? ` · ${formatDateShort(doc.document_date)}`
                    : ` · ${formatDateShort(doc.created_at)}`}
                </p>
                {doc.description ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.description}
                  </p>
                ) : null}
              </div>
              {doc.status === "archive" ? (
                <Badge variant="secondary">Archivé</Badge>
              ) : null}

              {doc.type === "lien_externe" && doc.external_url ? (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={doc.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink aria-hidden />
                    Ouvrir
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openFile(doc.id)}
                >
                  <Download aria-hidden />
                  Ouvrir
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={
                  doc.status === "actif"
                    ? `Archiver ${doc.name}`
                    : `Réactiver ${doc.name}`
                }
                onClick={() =>
                  startTransition(async () => {
                    await setDocumentArchived(doc.id, doc.status === "actif");
                  })
                }
              >
                {doc.status === "actif" ? (
                  <Archive aria-hidden />
                ) : (
                  <ArchiveRestore aria-hidden />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                aria-label={`Supprimer définitivement ${doc.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Supprimer définitivement « ${doc.name} » ? Cette action est irréversible. L'archivage est préférable.`
                    )
                  ) {
                    return;
                  }
                  startTransition(async () => {
                    const result = await deleteDocument(doc.id);
                    if (result.error) setError(result.error);
                  });
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Les fichiers sont stockés dans un espace privé. Les liens de
        consultation sont signés et expirent au bout de 5 minutes.
      </p>
    </div>
  );
}

function UploadDialog({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("company_id", companyId);
    startTransition(async () => {
      const result = await uploadDocument(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Téléverser un fichier</DialogTitle>
          <DialogDescription>
            Stockage privé, {formatFileSize(MAX_UPLOAD_BYTES)} maximum.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-file">Fichier *</Label>
            <Input id="doc-file" name="file" type="file" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-name">Nom affiché</Label>
            <Input
              id="doc-name"
              name="name"
              placeholder="Laisser vide pour utiliser le nom du fichier"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="doc-description">Description</Label>
            <Textarea id="doc-description" name="description" rows={2} />
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Téléverser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{
    name: string;
    external_url: string;
    description: string;
    document_date: string;
  }>({
    defaultValues: {
      name: "",
      external_url: "",
      description: "",
      document_date: "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un lien</DialogTitle>
          <DialogDescription>
            Un document hébergé ailleurs (Drive, Canva, Notion…).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            setServerError(null);
            const result = await createDocumentLink({
              ...values,
              company_id: companyId,
            });
            if (result.error) {
              setServerError(result.error);
              return;
            }
            setOpen(false);
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-name">Nom *</Label>
            <Input
              id="link-name"
              required
              {...register("name", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-url">URL *</Label>
            <Input
              id="link-url"
              required
              placeholder="https://…"
              {...register("external_url", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-description">Description</Label>
            <Textarea id="link-description" rows={2} {...register("description")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-date">Date du document</Label>
            <Input id="link-date" type="date" {...register("document_date")} />
          </div>
          {serverError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              <Plus aria-hidden />
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
