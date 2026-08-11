"use client";

import * as React from "react";

import {
  TaskFormDialog,
  type CompanyOption,
  type ProjectOption,
} from "@/components/tasks/task-form-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateShort, todayISODate } from "@/lib/dates";
import { TASK_STATUSES, type TaskStatus } from "@/lib/enums";
import {
  taskPriorityBadgeClass,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TaskWithRefs } from "@/types/database";

const KANBAN_COLUMNS = TASK_STATUSES.filter((s) => s !== "archivee");

/**
 * Vue Kanban en colonnes par statut. Le changement de statut se fait via la
 * carte (dialogue d'édition) — pas de glisser-déposer au MVP.
 */
export function TaskKanban({
  tasks,
  companies,
  projects,
}: {
  tasks: TaskWithRefs[];
  companies: CompanyOption[];
  projects: ProjectOption[];
}) {
  const today = todayISODate();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((status: TaskStatus) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={taskStatusLabels[status]}
            className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2"
          >
            <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
              {taskStatusLabels[status]}
              <span className="text-xs font-normal text-muted-foreground">
                {columnTasks.length}
              </span>
            </h3>
            {columnTasks.map((task) => {
              const isOverdue =
                task.status !== "terminee" &&
                task.due_date !== null &&
                task.due_date < today;
              return (
                <TaskFormDialog
                  key={task.id}
                  companies={companies}
                  projects={projects}
                  task={task}
                >
                  <button
                    type="button"
                    className="flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left shadow-xs transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {task.companies ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: task.companies.color }}
                            aria-hidden
                          />
                          {task.companies.name}
                        </span>
                      ) : null}
                      <Badge className={taskPriorityBadgeClass[task.priority]}>
                        {taskPriorityLabels[task.priority]}
                      </Badge>
                    </div>
                    {task.due_date ? (
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          isOverdue && "font-semibold text-destructive"
                        )}
                      >
                        Échéance {formatDateShort(task.due_date)}
                        {isOverdue ? " (en retard)" : ""}
                      </p>
                    ) : null}
                  </button>
                </TaskFormDialog>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
