/**
 * Service worker minimal de MAW Pilot.
 *
 * Volontairement simple : il rend l'application installable sans transformer
 * le MVP en chantier hors ligne. Il ne met en cache QUE la coquille statique
 * (icônes, manifest) et laisse toutes les données passer par le réseau —
 * mettre en cache des pages authentifiées exposerait des données privées.
 */

const CACHE_NAME = "mawpilot-shell-v1";
const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Jamais de cache pour les données, les mutations ou les pages : elles sont
  // privées et doivent toujours refléter l'état réel du serveur.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShellAsset =
    url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/");

  if (!isShellAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});
