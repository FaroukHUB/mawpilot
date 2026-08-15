import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileText,
  FolderOpen,
  Hourglass,
  MessagesSquare,
  Mic,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "MAW Pilot — Votre espace de suivi de projet",
  description:
    "Suivez l'avancement de votre projet en temps réel, échangez avec un assistant disponible à toute heure, consultez vos comptes rendus, vos résultats de référencement et vos livrables.",
};

/** Ce que le client trouve derrière la connexion. */
const FEATURES = [
  {
    icon: Sparkles,
    title: "Un assistant qui vous répond",
    body: "« Où en est ma page contact ? », « Pouvez-vous ajouter les horaires ? » — à l'écrit ou à la voix, à toute heure. Il connaît votre dossier, vous répond, et transmet ce qui doit l'être.",
  },
  {
    icon: Hourglass,
    title: "Vous savez ce qu'on attend de vous",
    body: "Un projet ralentit presque toujours faute d'une réponse. Ce qui bloque de votre côté est affiché en premier, en clair — plus de relances qui se perdent dans les mails.",
  },
  {
    icon: BarChart3,
    title: "L'avancement, en direct",
    body: "Une barre de progression par projet, ce qui est terminé, ce qui est en cours, la prochaine échéance. Vous n'avez plus à demander où ça en est : vous le voyez.",
  },
  {
    icon: FileText,
    title: "Des comptes rendus détaillés",
    body: "Chaque période a son compte rendu : ce qui a été réalisé, les points d'attention, la suite. Écrits à partir du travail réellement effectué, jamais d'un modèle recopié.",
  },
  {
    icon: Search,
    title: "Vos résultats, pas des promesses",
    body: "Positions, trafic, audiences : les chiffres de votre référencement et de vos statistiques sont repris dans vos comptes rendus, avec ce qu'ils veulent dire concrètement.",
  },
  {
    icon: FolderOpen,
    title: "Tous vos livrables au même endroit",
    body: "Maquettes, documents, exports, liens utiles : disponibles en permanence dans votre espace. Plus de fichier introuvable dans une vieille conversation.",
  },
];

/** Le parcours d'une demande, du message au suivi. */
const STEPS = [
  {
    title: "Vous dites ce dont vous avez besoin",
    body: "Dans votre espace, vous écrivez ou vous dictez. Une phrase suffit.",
  },
  {
    title: "L'assistant vous répond et transmet",
    body: "Il accuse réception, reformule, et prévient immédiatement votre prestataire.",
  },
  {
    title: "Vous suivez jusqu'au bout",
    body: "Votre demande apparaît dans votre suivi avec son statut, jusqu'à ce qu'elle soit faite.",
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
        <Button asChild size="sm">
          <Link href="/login">Se connecter</Link>
        </Button>
      </header>

      <main className="flex-1">
        {/* Accroche — adressée au client. */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center md:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
            <MessagesSquare className="size-3.5 text-primary" aria-hidden />
            Votre espace de suivi
          </span>

          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Ne demandez plus où ça en est.
            <br />
            <span className="text-primary">Regardez.</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            MAW Pilot est l&apos;espace où votre prestataire vous montre son
            travail au fil de l&apos;eau. Avancement en direct, comptes rendus
            détaillés, résultats chiffrés, livrables — et un assistant à qui
            vous pouvez parler quand vous voulez.
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
            Connectez-vous avec les identifiants transmis par votre prestataire.
            Il n&apos;y a pas d&apos;inscription : votre accès est créé pour vous.
          </p>
        </section>

        {/* Ce que le client y trouve. */}
        <section className="border-t bg-muted/30 px-5 py-16 md:py-20">
          <div className="mx-auto w-full max-w-5xl">
            <h2 className="mb-2 text-center text-2xl font-semibold">
              Ce que vous trouverez dans votre espace
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
              Tout ce qui concerne votre projet, réuni à un seul endroit et mis
              à jour au fur et à mesure du travail.
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-5"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Le parcours d'une demande. */}
        <section className="px-5 py-16 md:py-20">
          <div className="mx-auto w-full max-w-4xl">
            <h2 className="mb-2 text-center text-2xl font-semibold">
              Une demande, trois étapes
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
              Plus de mail sans réponse, plus de « je vous avais demandé de… ».
              Chaque demande est tracée.
            </p>

            <ol className="grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-5"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-center">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mic className="size-4" aria-hidden />
              </span>
              <p className="font-semibold">Pas envie d&apos;écrire ?</p>
              <p className="max-w-lg text-sm text-muted-foreground">
                Appuyez sur le micro et dictez votre demande. Elle est
                retranscrite, vous la relisez, vous envoyez.
              </p>
            </div>
          </div>
        </section>

        {/* Réassurance. */}
        <section className="border-t bg-muted/30 px-5 py-16 md:py-20">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-2xl border bg-card p-6 md:flex-row md:items-center md:p-10">
            <div className="flex-1">
              <h2 className="mb-3 text-2xl font-semibold">
                Un espace qui n&apos;appartient qu&apos;à vous
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {[
                  "Vous ne voyez que votre dossier, jamais celui d'un autre client.",
                  "L'assistant ne s'engage jamais sur une date à la place de votre prestataire.",
                  "Rien n'est inventé : les comptes rendus s'appuient sur le travail enregistré.",
                  "Vous gardez l'historique complet de vos demandes et des réponses.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
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
        MAW Pilot — espace de suivi de projet.{" "}
        <Link href="/login" className="underline hover:text-foreground">
          Connexion prestataire
        </Link>
      </footer>
    </div>
  );
}
