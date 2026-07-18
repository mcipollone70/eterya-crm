import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://crm.eterya.it"),
  applicationName: "Eterya CRM",
  title: {
    default: "Eterya CRM",
    template: "%s | Eterya CRM",
  },
  description:
    "CRM commerciale Eterya — gestione aziende, visite, percorsi intelligenti e promemoria vocali AI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Eterya CRM",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/eterya-crm-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/eterya-crm-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
