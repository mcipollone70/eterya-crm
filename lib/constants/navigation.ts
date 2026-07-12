import type { NavItem } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Importa Aziende", href: "/companies/import", icon: "FileUp" },
  { label: "Aziende", href: "/companies", icon: "Building2" },
  { label: "Contatti", href: "/contacts", icon: "Users" },
  { label: "Attività", href: "/activities", icon: "CheckSquare" },
  { label: "Visite", href: "/visits", icon: "MapPin" },
  { label: "Mappe", href: "/maps", icon: "Map" },
  { label: "Percorsi", href: "/routes", icon: "Route" },
  { label: "Promemoria vocali", href: "/voice", icon: "Mic" },
  { label: "Opportunità", href: "/opportunities", icon: "Target" },
  { label: "Prodotti", href: "/products", icon: "Package" },
  { label: "Report", href: "/reports", icon: "BarChart3" },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: "Impostazioni", href: "/settings", icon: "Settings" },
];

export const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/companies/import": "Importa Aziende",
  "/companies": "Aziende",
  "/contacts": "Contatti",
  "/activities": "Attività",
  "/visits": "Visite",
  "/maps": "Mappe",
  "/routes": "Percorsi",
  "/voice": "Promemoria vocali",
  "/opportunities": "Opportunità",
  "/products": "Prodotti",
  "/reports": "Report",
  "/settings": "Impostazioni",
};

export const APP_NAME = "Eterya CRM";
export const APP_TAGLINE = "Field Sales Intelligence";
