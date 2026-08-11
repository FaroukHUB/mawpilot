"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { createTask, updateTask } from "@/actions/tasks";
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
import type { Task } from "@/types/database";

export type CompanyOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; company_id: string };

type TaskFormValues = {
  company_id: string;
  project_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  due_date: string;
  estimated_minutes: string;
  billing_status: string;
  amount: string;
};

export function TaskFormDialog({
  companies,
  projects,
  task,
  defaultCompanyId,
  children,
}: {
  companies: CompanyOption[];
  projects: ProjectOption[];
  task?: Task;
  defaultCompanyId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm<TaskFormValues>({
    defaultValues: {
      company_id: task?.company_id ?? defaultCompanyId ?? companies[0]?.id ?? "",
      project_id: task?.project_id ?? "",
      title: task?.title ?? "",
      description: task?.description ?? "",
      category: task?.category ?? "autre",
      status: task?.status ?? "a_faire",
      priority: task?.priority ?? "normale",
      due_date: task?.due_date ?? "",
      estimated_minutes: task?.estimated_minutes?.toString() ?? "",
      billing_status: task?.billing_status ?? "incluse",
      amount: task?.amount?.toString() ?? "",
    },
  });

  const selectedCompanyId = useWatch({ control, name: "company_id" });
  const companyProjects = projects.filter(
    (p) => p.company_id === selectedCompanyId
  );

  async function onSubmit(values: TaskFormValues) {
    setServerError(null);
    const result = task
      ? await updateTask(task.id, values)
      : await createTask(values);

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
            {task ? "Modifier la tâche" : "Nouvelle tâche"}
          </DialogTitle>
          <DialogDescription>
            Chaque tâche appartient à une entreprise ; le projet est facultatif.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-company">Entreprise *</Label>
              <Select
                id="task-company"
                required
                {...register("company_id", {
                  required: true,
                  onChange: () => setValue("project_id", ""),
                })}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-project">Projet</Label>
              <Select id="task-project" {...register("project_id")}>
                <option value="">— Aucun —</option>
                {companyProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Titre *</Label>
            <Input
              id="task-title"
              required
              {...register("title", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              rows={3}
              {...register("description")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-category">Catégorie</Label>
              <Select id="task-category" {...register("category")}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {taskCategoryLabels[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-status">Statut</Label>
              <Select id="task-status" {...register("status")}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {taskStatusLabels[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-priority">Priorité</Label>
              <Select id="task-priority" {...register("priority")}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {taskPriorityLabels[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-due">Échéance</Label>
              <Input id="task-due" type="date" {...register("due_date")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-estimate">Estimation (min)</Label>
              <Input
                id="task-estimate"
                type="number"
                min="0"
                {...register("estimated_minutes")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-billing">Facturation</Label>
              <Select id="task-billing" {...register("billing_status")}>
                {BILLING_STATUSES.map((b) => (
                  <option key={b} value={b}>
                    {billingStatusLabels[b]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-amount">Montant (€, si facturable)</Label>
            <Input
              id="task-amount"
              type="number"
              min="0"
              step="0.01"
              {...register("amount")}
            />
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
              {task ? "Enregistrer" : "Créer la tâche"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
