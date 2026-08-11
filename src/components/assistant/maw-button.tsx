"use client";

import * as React from "react";
import { Mic } from "lucide-react";

import { VoiceSheet } from "@/components/assistant/voice-sheet";
import { cn } from "@/lib/utils";

/**
 * Bouton « Parler à MAW » — présent sur toutes les pages.
 *
 * C'est l'entrée principale de l'application : les écrans servent à consulter
 * ce que la voix a rempli. Placé au-dessus de la barre de navigation sur
 * mobile, en bas à droite sur ordinateur.
 */
export function MawButton({ isConfigured }: { isConfigured: boolean }) {
  const [open, setOpen] = React.useState(false);

  // Raccourci clavier : Ctrl/Cmd + K, comme les palettes de commandes.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!isConfigured) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Parler à MAW — dicter une demande"
        className={cn(
          "fixed right-4 bottom-20 z-30 flex items-center gap-2 rounded-full bg-primary py-3 pr-5 pl-4 font-semibold text-primary-foreground shadow-lg transition-transform",
          "hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          "md:right-6 md:bottom-6",
          "print:hidden"
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground/15">
          <Mic className="size-4" aria-hidden />
        </span>
        <span className="text-sm">Parler à MAW</span>
      </button>

      <VoiceSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
