/**
 * Service Worker do Privello.
 *
 * Estratégia:
 *
 * - **Assets estáticos** (`/_next/static/*`, `/icon.png`, ícones do
 *   manifest): cache-first com stale revalidation.
 * - **HTML / RSC payloads**: network-first com fallback ao cache —
 *   a página abre online com dados frescos, mas se o usuário
 *   estiver offline, vê o último HTML em cache (telas
 *   degradadas mas não white screen).
 * - **APIs (`/api/*`)**: sempre network. Nunca cacheia (dados
 *   dinâmicos, autenticados).
 * - **Storage (`/api/storage/*`)**: passthrough — o Next/CDN já
 *   cuida do cache de mídia, não duplicamos no SW.
 *
 * Versão é bumped a cada deploy via timestamp injetado no nome do
 * cache. Mudou o nome → SW novo invalida tudo no `activate`.
 */

const VERSION = "v1";
const STATIC_CACHE = `privello-static-${VERSION}`;
const HTML_CACHE = `privello-html-${VERSION}`;

// URLs essenciais pra "shell" funcionar offline. Mantido pequeno —
// o restante entra no cache organicamente conforme o usuário navega.
const PRECACHE_URLS = [
    "/",
    "/icon.png",
    "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
    );
    // Ativa o SW novo imediatamente, sem esperar abas antigas
    // fecharem.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter(
                        (k) =>
                            k !== STATIC_CACHE &&
                            k !== HTML_CACHE &&
                            k.startsWith("privello-"),
                    )
                    .map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // APIs e storage: passthrough.
    if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/_next/data/")
    ) {
        return;
    }

    // Assets estáticos: cache-first.
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname === "/icon.png" ||
        url.pathname === "/manifest.webmanifest" ||
        url.pathname === "/logo.png" ||
        url.pathname === "/logo-border.png" ||
        url.pathname === "/privello.png"
    ) {
        event.respondWith(cacheFirst(req, STATIC_CACHE));
        return;
    }

    // HTML / RSC: network-first.
    const accept = req.headers.get("accept") ?? "";
    if (req.mode === "navigate" || accept.includes("text/html")) {
        event.respondWith(networkFirst(req, HTML_CACHE));
        return;
    }
});

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
        // Stale revalidation em background — não bloqueia a resposta.
        fetch(request)
            .then((res) => {
                if (res.ok) cache.put(request, res.clone());
            })
            .catch(() => {});
        return cached;
    }
    try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
    } catch (e) {
        return cached ?? new Response("", { status: 504 });
    }
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
    } catch (e) {
        const cached = await cache.match(request);
        return cached ?? new Response("Offline", { status: 503 });
    }
}
