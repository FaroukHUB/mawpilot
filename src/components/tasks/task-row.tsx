"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Pencil, Undo2 } from "lucide-react";

import { setTaskStatus } from "@/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TaskFormDialog,
  type CompanyOption,
  type ProjectOption,
} from "@/components/tasks/task-form-dialog";
import { formatDateShort } from "@/lib/dates";
import {
  taskPriorityBadgeClass,
  taskPriorityLabels,
  taskStatusBadgeClass,
  taskStatusLabels,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskWithRefs } from "@/types/database";

export function TaskRow({
  task,
  companies,
  projects,
  showCompany = true,
}: {
  task: TaskWithRefs;
  companies: CompanyOption[];
  projects: ProjectOption[];
  showCompany?: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const isDone = task.status === "terminee";
  const isOverdue =
    !isDone &&
    task.due_date !== null &&
    task.due_date < new Date().toISOString().slice(0, 10);

  function toggleDone() {
    startTransition(async () => {
      await setTaskStatus(task.id, isDone ? "a_faire" : "terminee");
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        isDone && "opacity-60"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleDone}
        disabled={isPending}
        aria-label={isDone ? "Reprendre la tâche" : "Marquer comme terminée"}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : isDone ? (
          <Undo2 aria-hidden />
        ) : (
          <CheckCircle2 aria-hidden />
        )}
      </Button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", isDone && "line-through")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {showCompany && task.companies ? (
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: task.companies.color }}
                aria-hidden
              />
              {task.companies.name}
            </span>
          ) : null}
          {task.projects ? <span>· {task.projects.name}</span> : null}
          {task.due_date ? (
            <span className={cn(isOverdue && "font-semibold text-destructive")}>
              · Échéance {formatDateShort(task.due_date)}
              {isOverdue ? " (en retard)" : ""}
            </span>
          ) : null}
        </div>
      </div>
      <Badge className={taskStatusBadgeClass[task.status]}>
        {taskStatusLabels[task.status]}
      </Badge>
      <Badge className={taskPriorityBadgeClass[task.priority]}>
        {taskPriorityLabels[task.priority]}
      </Badge>
      <TaskFormDialog companies={companies} projects={projects} task={task}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Modifier la tâche"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Pencil aria-hidden />
        </Button>
      </TaskFormDialog>
    </div>
  );
}
