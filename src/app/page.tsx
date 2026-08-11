import { Rocket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Page provisoire : redirigera vers /dashboard (ou /login) à partir de la phase 2.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-2xl">MAW Pilot</CardTitle>
          <CardDescription>
            Pilotage d&apos;activité freelance multi-entreprises
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <Badge variant="secondary">Phase 1 — Fondations</Badge>
          <p>
            L&apos;application est en cours de construction. La connexion et le
            tableau de bord arrivent à la phase 2.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
