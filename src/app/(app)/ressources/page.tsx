import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Accès rapides" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Accès rapides"
      phase="phase 4"
      description="Raccourcis vers les sites et outils de chaque entreprise"
    />
  );
}
