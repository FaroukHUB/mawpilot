import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Assistant IA" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Assistant IA"
      phase="phase 6"
      description="Assistant texte et voix en français"
    />
  );
}
