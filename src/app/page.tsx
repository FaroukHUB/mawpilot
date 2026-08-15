import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  FileText,
  Mic,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "MAW Pilot — Le pilotage d'activité qui se remplit à la voix",
  description:
    "Tâches, temps, rapports et suivi client : vous parlez, MAW Pilot range. Espace de suivi dédié pour vos clients.",
};

const FEATURES = [
  {
    icon: Mic,
    title: "Vous parlez, il range",
    body: "« J'ai travaillé une heure trente sur Trust et terminé l'article » : le temps est enregistré, les tâches sont mises à jour. Aucun tableau à remplir.",
  },
  {
    icon: FileText,
    title: "Les rapports se préparent seuls",
    body: "Chaque semaine, le compte rendu est prêt à partir de vos données réelles. Vous relisez, vous partagez sur WhatsApp. Rien n'est inventé.",
  },
  {
    icon: BellRing,
    title: "Il pense à votre place",
    body: "Briefing du matin, relance quand un client ne répond pas, rappel « vendredi à 15 h ». Les notifications arrivent même application fermée.",
  },
  {
    icon: Users,
    title: "Vos clients suivent en direct",
    body: "Chaque client a son espace : ce qui avance, ce qui l'attend, ses livrables. Il y dépose ses demandes, à l'écrit ou à la voix.",
  },
  {
    icon: Building2,
    title: "Un cockpit par entreprise",
    body: "Projets, tâches, temps, contacts, documents, accès rapides et historique complet — tout ce qui concerne un client au même endroit.",
  },
  {
    icon: ShieldCheck,
    title: "Vous gardez la main",
    body: "Chaque action proposée est confirmée par vous avant d'être enregistrée. Aucun message n'est jamais envoyé à un client sans votre accord.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-5 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">MAW Pilot</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Se connecter</Link>
        </Button>
      </header>

      <main className="flex-1">
        {/* Accroche */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <Mic className="size-3.5 text-primary" aria-hidden />
            Piloté à la voix
          </span>

          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Racontez votre journée.
            <br />
            <span className="text-primary">MAW Pilot remplit le reste.</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            Le poste de pilotage des freelances qui jonglent entre plusieurs
            clients. Tâches, temps passé, prestations à facturer, comptes
            rendus : vous dictez, tout se range derrière.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                Accéder à mon espace
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Application privée. Les accès sont créés par l&apos;administrateur —
            il n&apos;y a pas d&apos;inscription libre.
          </p>
        </section>

        {/* Fonctionnalités */}
        <section className="border-t bg-muted/30 px-5 py-16 md:py-20">
          <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-2 rounded-xl border bg-card p-5"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Espace client */}
        <section className="px-5 py-16 md:py-20">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl border bg-card p-6 md:flex-row md:items-center md:p-10">
            <div className="flex-1">
              <h2 className="mb-2 text-2xl font-semibold">
                Vous êtes client ?
              </h2>
              <p className="text-muted-foreground">
                Connectez-vous avec les identifiants qui vous ont été
                transmis. Vous verrez l&apos;avancement de votre projet en
                temps réel, ce qui attend votre retour, vos livrables et vos
                comptes rendus — et vous pourrez déposer vos demandes
                directement, à l&apos;écrit ou en vocal.
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                {[
                  "Ce qui a été réalisé, avec les dates",
                  "Ce qui est en cours et ce qui arrive",
                  "Vos demandes, suivies une par une",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/login">
                Accéder à mon suivi
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t px-5 py-6 text-center text-xs text-muted-foreground">
        MAW Pilot — application privée de pilotage d&apos;activité.
      </footer>
    </div>
  );
}
