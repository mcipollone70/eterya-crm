"use client";

import { useEffect } from "react";

/**
 * Registra il service worker solo in produzione (client-only).
 * Nessun reload forzato su update → evita loop e non interferisce con npm run dev.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration("/");
        if (cancelled) return;

        if (existing) {
          // Aggiornamento silenzioso; niente location.reload()
          void existing.update();
          return;
        }

        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Installabilità resta via manifest anche se SW fallisce
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
