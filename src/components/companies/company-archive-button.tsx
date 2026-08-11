"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";

import { setCompanyActive } from "@/actions/companies";
import { Button } from "@/components/ui/button";

/** Archive/réactive une entreprise (jamais de suppression). */
export function CompanyArchiveButton({
  companyId,
  isActive,
}: {
  companyId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();

  function toggle() {
    if (
      isActive &&
      !window.confirm(
        "Archiver cette entreprise ? Elle restera consultable et pourra être réactivée."
      )
    ) {
      return;
    }
    startTransition(async () => {
      await setCompanyActive(companyId, !isActive);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={isPending}>
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : isActive ? (
        <Archive aria-hidden />
      ) : (
        <ArchiveRestore aria-hidden />
      )}
      {isActive ? "Archiver" : "Réactiver"}
    </Button>
  );
}
