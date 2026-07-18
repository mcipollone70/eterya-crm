/* Eterya CRM — service worker minimale (solo asset statici).
 * NON cache: HTML autenticato, API (incluso TTS), Supabase, Server Actions,
 * token/sessioni, PII, tile mappa, audio Joy, RSC/flight.
 */
const CACHE_NAME = "eterya-crm-static-v2";

const PRECACHE_URLS = [
  "/icons/eterya-crm-192.png",
  "/icons/eterya-crm-512.png",
  "/icons/eterya-crm-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
];

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const { pathname } = url;

  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/_next/static/")) return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") return true;
  if (pathname === "/favicon.ico" || pathname === "/icon" || pathname === "/apple-icon") {
    return true;
  }

  // Solo estensioni statiche note — mai .mp3/.wav da API
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|css)$/i.test(pathname);
}

function isNeverCacheRequest(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  if (request.mode === "navigate") return true;

  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) return true;
  if (accept.includes("audio/")) return true;

  const { pathname } = url;

  // API / auth / login — network only (TTS, sessioni, Server Actions via fetch)
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/login")) return true;

  // Next.js RSC / flight / server actions markers
  if (request.headers.has("rsc")) return true;
  if (request.headers.has("next-action")) return true;
  if (request.headers.get("next-router-state-tree")) return true;

  // Cross-origin (Supabase, OSM tiles, OpenAI, Google, …)
  if (url.origin !== self.location.origin) return true;

  // Difesa in profondità: audio / tile path-like
  if (/\.(?:mp3|wav|ogg|m4a|aac)(?:\?|$)/i.test(pathname)) return true;
  if (/tile\.openstreetmap|\/tiles?\//i.test(url.href)) return true;

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isNeverCacheRequest(request, url)) {
    return;
  }

  if (!isStaticAsset(url)) {
    return;
  }

  // Cache-first solo per asset statici versionati (_next/static, icons, font, css)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
  );
});
