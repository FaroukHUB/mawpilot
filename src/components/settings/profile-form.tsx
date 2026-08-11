"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Check, Loader2 } from "lucide-react";

import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileFormValues = {
  full_name: string;
  timezone: string;
};

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: ProfileFormValues;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({ defaultValues });

  async function onSubmit(values: ProfileFormValues) {
    setServerError(null);
    setSaved(false);
    const result = await updateProfile(values);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">Nom affiché</Label>
        <Input
          id="profile-name"
          required
          {...register("full_name", { required: true })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-timezone">Fuseau horaire</Label>
        <Input id="profile-timezone" {...register("timezone")} />
        <p className="text-xs text-muted-foreground">
          L&apos;application fonctionne en Europe/Paris par défaut.
        </p>
      </div>
      {serverError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          Enregistrer
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <Check className="size-4" aria-hidden />
            Enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}
