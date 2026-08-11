import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="mb-4 text-2xl font-semibold">Tableau de bord</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue dans MAW Pilot</CardTitle>
          <CardDescription>
            La connexion fonctionne. Le contenu du tableau de bord (urgences,
            retards, temps passé, charge par entreprise…) arrive en phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Prochaine étape : la gestion des entreprises, projets et tâches.
        </CardContent>
      </Card>
    </div>
  );
}
