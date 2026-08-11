import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Rapports" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Rapports"
      phase="phase 5"
      description="Rapports hebdomadaires et mensuels par entreprise"
    />
  );
}
