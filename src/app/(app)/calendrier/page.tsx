import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Calendrier" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Calendrier"
      phase="phase 3"
      description="Vue calendrier des tâches et échéances"
    />
  );
}
