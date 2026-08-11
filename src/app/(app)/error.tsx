"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Erreur applicative :", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg items-center py-12">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden />
          </div>
          <CardTitle>Une erreur est survenue</CardTitle>
          <CardDescription>
            Vos données ne sont pas perdues. Réessayez : si le problème
            persiste, rechargez la page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button onClick={reset}>
            <RotateCcw aria-hidden />
            Réessayer
          </Button>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Référence : {error.digest}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
