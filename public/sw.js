/**
 * Service worker minimal de MAW Pilot.
 *
 * Volontairement simple : il rend l'application installable sans transformer
 * le MVP en chantier hors ligne. Il ne met en cache QUE la coquille statique
 * (icônes, manifest) et laisse toutes les données passer par le réseau —
 * mettre en cache des pages authentifiées exposerait des données privées.
 */

// À incrémenter dès que le manifeste ou une icône change : sinon les
// appareils déjà installés continuent de servir l'ancienne version.
const CACHE_NAME = "mawpilot-shell-v3";
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

/**
 * Notifications push — c'est ce qui permet d'être prévenu application fermée.
 */
self.addEventListener("push", (event) => {
  let payload = { title: "MAW Pilot by Farouk", body: "", url: "/dashboard" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "fr",
      // Regroupe les notifications d'un même sujet plutôt que de les empiler.
      tag: payload.tag || "mawpilot",
      renotify: true,
      data: { url: payload.url || "/dashboard" },
    })
  );
});

/** Au clic : rouvrir l'onglet existant si possible, sinon en ouvrir un. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
