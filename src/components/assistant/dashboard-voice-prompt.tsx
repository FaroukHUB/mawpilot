"use client";

import * as React from "react";
import { Mic } from "lucide-react";

import { VoiceSheet } from "@/components/assistant/voice-sheet";
import { Card, CardContent } from "@/components/ui/card";

/** Exemples réels, cliquables : ils montrent ce que la dictée sait faire. */
const EXAMPLES = [
  "Aujourd'hui j'ai travaillé une heure trente sur Trust, j'ai corrigé trois produits et terminé l'article de blog.",
  "J'ai deux heures devant moi, dis-moi ce que je dois faire en priorité.",
  "Crée Collection Originale, contact Olivier, ajoute son site.",
];

/**
 * Accroche vocale du tableau de bord : rappelle que la voix est l'entrée
 * principale de MAW Pilot, et que les écrans se remplissent derrière.
 */
export function DashboardVoicePrompt() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card className="gap-3 border-primary/30 bg-primary/5 py-4">
        <CardContent className="flex flex-col gap-3 px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Mic className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">
                Racontez votre journée
              </span>
              <span className="block text-sm text-muted-foreground">
                MAW remplit les tâches, le temps et les rapports à votre place.
              </span>
            </span>
          </button>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setOpen(true)}
                className="max-w-full truncate rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title={example}
              >
                « {example} »
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <VoiceSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
