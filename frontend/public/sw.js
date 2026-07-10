const CACHE_NAME = "advens-wifi-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icons.svg"
];

// Force le nouveau SW à remplacer l'ancien immédiatement
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Supprime les anciens caches au moment de l'activation
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie network-first : toujours chercher le réseau d'abord,
// utiliser le cache uniquement en mode hors-ligne
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Met à jour le cache avec la réponse fraîche
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Hors-ligne : utiliser le cache
        return caches.match(e.request);
      })
  );
});
