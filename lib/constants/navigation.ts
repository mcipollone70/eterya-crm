import type { NavItem } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Importa Aziende", href: "/companies/import", icon: "FileUp" },
  { label: "Aziende", href: "/companies", icon: "Building2" },
  { label: "Contatti", href: "/contacts", icon: "Users" },
  { label: "Attività", href: "/activities", icon: "CheckSquare" },
  { label: "Agenda", href: "/agenda", icon: "CalendarDays" },
  { label: "Assistente", href: "/assistant", icon: "Sparkles" },
  { label: "Visite", href: "/visits", icon: "MapPin" },
  { label: "Mappa", href: "/maps", icon: "Map" },
  { label: "Giro Visite", href: "/routes", icon: "Route" },
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
  "/agenda": "Agenda",
  "/assistant": "Assistente commerciale",
  "/visits": "Visite",
  "/maps": "Mappa",
  "/routes": "Giro Visite",
  "/voice": "Promemoria vocali",
  "/opportunities": "Opportunità",
  "/products": "Prodotti",
  "/reports": "Dashboard Commerciale Avanzata",
  "/settings": "Impostazioni",
};

export const APP_NAME = "Eterya CRM";
export const APP_TAGLINE = "Field Sales Intelligence";
