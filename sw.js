// Service worker: prima la rete (timeout 3 s), poi la cache
const CACHE = "palestra-v0.1";
const FILE = ["./", "index.html", "style.css", "app.js", "esercizi.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    new Promise((ok) => {
      const t = setTimeout(() => caches.match(e.request).then((r) => r && ok(r)), 3000);
      fetch(e.request).then((r) => {
        clearTimeout(t);
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        ok(r);
      }).catch(() => { clearTimeout(t); caches.match(e.request).then((r) => ok(r || Response.error())); });
    })
  );
});
