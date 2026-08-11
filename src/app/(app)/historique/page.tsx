import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Historique" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Historique"
      phase="phase 3"
      description="Chronologie complète des actions"
    />
  );
}
