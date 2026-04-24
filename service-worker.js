const CACHE_NAME = "granaflow-cache-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./logo-granaflow.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usar map para tentar adicionar cada arquivo individualmente e não travar tudo se um falhar
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(err => console.warn(`Falha ao cachear: ${url}`, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  // Ignorar extensões do Chrome e outros esquemas não suportados
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }).catch(async () => {
        const fallback = await caches.match(request);
        if (fallback) return fallback;
        return new Response("", { status: 503, statusText: "Offline" });
      });
    })
  );
});
