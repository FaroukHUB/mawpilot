"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { logTime } from "@/actions/time-entries";
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
import { Textarea } from "@/components/ui/textarea";

type TimeFormValues = {
  minutes: string;
  entry_date: string;
  description: string;
  is_billable: boolean;
};

export function TimeEntryDialog({
  companyId,
  taskId,
  taskTitle,
  children,
}: {
  companyId: string;
  taskId?: string;
  taskTitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<TimeFormValues>({
    defaultValues: {
      minutes: "",
      entry_date: new Date().toISOString().slice(0, 10),
      description: "",
      is_billable: false,
    },
  });

  async function onSubmit(values: TimeFormValues) {
    setServerError(null);
    const result = await logTime({
      ...values,
      company_id: companyId,
      task_id: taskId ?? "",
    });
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer du temps</DialogTitle>
          <DialogDescription>
            {taskTitle
              ? `Temps passé sur « ${taskTitle} ».`
              : "Temps passé pour cette entreprise."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="time-minutes">Durée (minutes) *</Label>
            <Input
              id="time-minutes"
              type="number"
              min="1"
              required
              {...register("minutes", { required: true })}
            />
            <div className="flex gap-1.5">
              {[15, 30, 60, 120].map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setValue("minutes", String(m), { shouldDirty: true })
                  }
                >
                  {m >= 60 ? `${m / 60} h` : `${m} min`}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="time-date">Date</Label>
            <Input id="time-date" type="date" {...register("entry_date")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="time-description">Description</Label>
            <Textarea
              id="time-description"
              rows={2}
              placeholder="Ce qui a été fait pendant ce temps…"
              {...register("description")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand-orange)]"
              {...register("is_billable")}
            />
            Temps facturable (hors forfait)
          </label>
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
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
