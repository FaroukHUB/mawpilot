"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { createProject, updateProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_STATUSES } from "@/lib/enums";
import { projectStatusLabels } from "@/lib/labels";
import type { Project } from "@/types/database";

type ProjectFormValues = {
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
};

export function ProjectFormDialog({
  companyId,
  project,
  children,
}: {
  companyId: string;
  project?: Project;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      status: project?.status ?? "actif",
      start_date: project?.start_date ?? "",
      end_date: project?.end_date ?? "",
    },
  });

  async function onSubmit(values: ProjectFormValues) {
    setServerError(null);
    const payload = { ...values, company_id: companyId };
    const result = project
      ? await updateProject(project.id, payload)
      : await createProject(payload);

    if (result.error) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? "Modifier le projet" : "Nouveau projet"}
          </DialogTitle>
          <DialogDescription>
            Un projet regroupe des tâches pour cette entreprise.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Nom *</Label>
            <Input
              id="project-name"
              required
              {...register("name", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={3}
              {...register("description")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-status">Statut</Label>
              <Select id="project-status" {...register("status")}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {projectStatusLabels[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-start">Début</Label>
              <Input
                id="project-start"
                type="date"
                {...register("start_date")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-end">Fin</Label>
              <Input id="project-end" type="date" {...register("end_date")} />
            </div>
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
              {project ? "Enregistrer" : "Créer le projet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
