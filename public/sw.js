/* Eterya CRM — service worker minimale (solo asset statici).
 * NON cache / network-only (nessun respondWith):
 * - POST/PUT/PATCH/DELETE (TTS Joy = POST /api/joy-ai/tts)
 * - /api/* (incluso audio generato), Server Actions, sessioni, auth
 * - HTML navigations, Accept: audio/*, blob audio path
 * - Supabase, tile mappa, Google Maps, RSC/flight
 * Cache-first SOLO per icons/_next/static/font/css versionati.
 * Bump CACHE_NAME + clear old caches on activate.
 */
const CACHE_NAME = "eterya-crm-static-v4";

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
  if (pathname.startsWith("/maps")) return true;
  if (pathname.startsWith("/giro-visite") || pathname.startsWith("/routes")) return true;

  // Next.js RSC / flight / server actions markers
  if (request.headers.has("rsc")) return true;
  if (request.headers.has("next-action")) return true;
  if (request.headers.get("next-router-state-tree")) return true;

  // Cross-origin (Supabase, OSM tiles, OpenAI, Google Maps, …)
  if (url.origin !== self.location.origin) return true;

  // Difesa in profondità: audio / tile path-like / maps providers
  if (/\.(?:mp3|wav|ogg|m4a|aac)(?:\?|$)/i.test(pathname)) return true;
  if (/tile\.openstreetmap|\/tiles?\//i.test(url.href)) return true;
  if (/google\.(?:com|it).*\/maps/i.test(url.href)) return true;
  if (/maps\.googleapis\.com|maps\.gstatic\.com/i.test(url.href)) return true;

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

  // Network-only for never-cache: do not call respondWith → browser default fetch.
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
