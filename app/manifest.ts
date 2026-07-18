import type { MetadataRoute } from "next";

/**
 * Web App Manifest — Eterya CRM PWA installabile (standalone).
 * Servito da Next come /manifest.webmanifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eterya CRM",
    short_name: "Eterya CRM",
    description: "CRM commerciale Eterya",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "it-IT",
    background_color: "#f8fafc",
    theme_color: "#020617",
    icons: [
      {
        src: "/icons/eterya-crm-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/eterya-crm-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/eterya-crm-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
