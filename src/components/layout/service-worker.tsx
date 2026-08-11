"use client";

import * as React from "react";

/**
 * Enregistre le service worker (installation PWA).
 * Uniquement en production : en développement, il masquerait les changements.
 */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // L'installation PWA est un confort : son échec ne casse rien.
    });
  }, []);

  return null;
}
