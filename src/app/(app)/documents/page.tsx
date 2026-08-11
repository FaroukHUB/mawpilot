import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Documents"
      phase="phase 4"
      description="Fichiers, tableaux, livrables et liens"
    />
  );
}
