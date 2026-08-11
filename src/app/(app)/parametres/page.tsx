import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Paramètres"
      phase="phase 3"
      description="Profil et préférences de l'application"
    />
  );
}
