// FinTrack service worker — offline app shell.
// Data lives in LocalStorage, so the only thing that must survive going offline
// is the bundle. Reads are network-first and mirrored into the cache, which
// keeps a dev-server rebuild fresh while still answering when the network is
// gone.
const CACHE = "fintrack-v3";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/img/icon-192.png", "/img/icon-512.png"];

// The document request is not intercepted on a very first visit — no worker
// exists yet — so precaching only the shell would leave main.js uncached and a
// cold offline start blank. Enumerate what index.html actually references and
// cache those too; that survives chunk renames and code-splitting. DOMParser is
// not exposed in a service worker, hence the attribute scan.
async function precacheShell() {
  const cache = await caches.open(CACHE);
  const urls = new Set(SHELL);
  try {
    const html = await (await fetch("/index.html")).text();
    for (const [, raw] of html.matchAll(/(?:src|href)\s*=\s*["']([^"'<>]+)["']/gi)) {
      if (/^(https?:|data:|#|\/\/)/i.test(raw)) continue;
      const resolved = new URL(raw, self.location.href);
      if (resolved.origin === self.location.origin) urls.add(resolved.pathname + resolved.search);
    }
  } catch {
    // Nothing more to learn; the fixed shell entries still get cached.
  }
  await Promise.allSettled([...urls].map(url => cache.add(url)));
}

self.addEventListener("install", event => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/ws")) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(async cached => {
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        })
      )
  );
});

// Tapping the reminder is a route back into the app: an already-open window is
// focused where it stands (the save sheet is global, so it is already there),
// and with nothing running the app launches at the URL the notification carried.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      })
  );
});
