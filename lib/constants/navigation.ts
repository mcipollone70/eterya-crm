import type { NavItem } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { label: "Centro Operativo CRM", href: "/command-center", icon: "Sparkles", section: "Panoramica" },
  { label: "Dashboard", href: "/", icon: "LayoutDashboard", section: "Panoramica" },
  { label: "Mission Control", href: "/mission-control", icon: "Radar", section: "Panoramica" },
  { label: "Notifiche", href: "/notifiche", icon: "Bell", section: "Panoramica" },

  { label: "Aziende", href: "/companies", icon: "Building2", section: "Clienti" },
  { label: "Contatti", href: "/contacts", icon: "Users", section: "Clienti" },
  { label: "Importa Aziende", href: "/companies/import", icon: "FileUp", section: "Clienti" },

  { label: "Attività", href: "/activities", icon: "CheckSquare", section: "Agenda e campo" },
  { label: "Agenda", href: "/agenda", icon: "CalendarDays", section: "Agenda e campo" },
  { label: "Calendario condiviso", href: "/calendario", icon: "CalendarRange", section: "Agenda e campo" },
  { label: "Visite", href: "/visits", icon: "MapPin", section: "Agenda e campo" },
  { label: "Giro Visite", href: "/giro-visite", icon: "Route", section: "Agenda e campo" },
  { label: "Modalità Auto", href: "/auto", icon: "Car", section: "Agenda e campo" },
  { label: "Mappa", href: "/maps", icon: "Map", section: "Agenda e campo" },
  { label: "Promemoria vocali", href: "/voice", icon: "Mic", section: "Agenda e campo" },

  { label: "Pipeline Commerciale", href: "/opportunities", icon: "Target", section: "Vendite" },
  { label: "Preventivi", href: "/preventivi", icon: "FileText", section: "Vendite" },
  { label: "Ordini", href: "/ordini", icon: "ShoppingCart", section: "Vendite" },
  { label: "Campioni", href: "/campioni", icon: "Boxes", section: "Vendite" },
  { label: "Assistenza", href: "/assistenza", icon: "LifeBuoy", section: "Vendite" },
  { label: "Catalogo Prodotti", href: "/products", icon: "Package", section: "Vendite" },
  { label: "Documenti", href: "/documenti", icon: "FolderOpen", section: "Vendite" },

  { label: "Report Commerciali", href: "/report-commerciale", icon: "FileBarChart", section: "Analisi" },
  { label: "Statistiche", href: "/statistiche", icon: "LineChart", section: "Analisi" },
  { label: "Dashboard Avanzata", href: "/reports", icon: "BarChart3", section: "Analisi" },

  { label: "Assistente", href: "/assistant", icon: "Sparkles", section: "Intelligenza" },
  { label: "JOY Command Center", href: "/joy-ai", icon: "Bot", section: "Intelligenza" },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Utenti", href: "/admin/users", icon: "Shield", section: "Amministrazione" },
  { label: "Ruoli e permessi", href: "/admin/permissions", icon: "ShieldCheck", section: "Amministrazione" },
  { label: "Configurazione", href: "/configurazione", icon: "Building2", section: "Amministrazione" },
  { label: "Backup", href: "/backup", icon: "DatabaseBackup", section: "Amministrazione" },
  { label: "Audit Log", href: "/audit-log", icon: "History", section: "Amministrazione" },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: "Manuale", href: "/manuale", icon: "BookOpen" },
  { label: "Impostazioni", href: "/settings", icon: "Settings" },
];

/** Scorciatoie campo su mobile (bottom nav) — Joy centrale. */
export const MOBILE_FIELD_NAV_ITEMS: NavItem[] = [
  { label: "Giro", href: "/giro-visite", icon: "Route" },
  { label: "Agenda", href: "/agenda", icon: "CalendarDays" },
  { label: "Joy", href: "/joy-ai", icon: "Bot" },
  { label: "Aziende", href: "/companies", icon: "Building2" },
  { label: "Altro", href: "__menu__", icon: "Menu" },
];

export const PAGE_TITLES: Record<string, string> = {
  "/": "Centro Operativo",
  "/mission-control": "Mission Control",
  "/command-center": "Centro Operativo CRM",
  "/companies/import": "Importa Aziende",
  "/companies": "Aziende",
  "/contacts": "Contatti",
  "/activities": "Attività",
  "/agenda": "Agenda",
  "/calendario": "Calendario condiviso",
  "/notifiche": "Notifiche intelligenti",
  "/assistant": "Assistente commerciale",
  "/joy": "JOY Command Center",
  "/joy-ai": "JOY Command Center",
  "/joy-ai/drive": "Joy Drive",
  "/joy/chat": "JOY Command Center",
  "/joy/autonomous": "JOY Command Center",
  "/visits": "Visite",
  "/auto": "Modalità Auto",
  "/maps": "Mappa",
  "/giro-visite": "Giro Visite",
  "/routes": "Giro Visite",
  "/voice": "Funzioni vocali",
  "/opportunities": "Pipeline Commerciale",
  "/pipeline": "Pipeline Commerciale",
  "/preventivi": "Preventivi",
  "/ordini": "Ordini",
  "/campioni": "Gestione Campioni",
  "/assistenza": "Gestione Assistenza",
  "/documenti": "Gestione Documenti",
  "/products": "Catalogo Prodotti",
  "/report-commerciale": "Report Commerciali",
  "/statistiche": "Statistiche avanzate",
  "/reports": "Dashboard Commerciale Avanzata",
  "/settings": "Impostazioni",
  "/manuale": "Manuale Operativo",
  "/admin/users": "Amministrazione utenti",
  "/admin/users/new": "Nuovo utente",
  "/admin/permissions": "Ruoli e permessi",
  "/configurazione": "Configurazione Azienda",
  "/backup": "Backup e Ripristino",
  "/audit-log": "Audit Log",
};

export const APP_NAME = "Eterya CRM";
export const APP_TAGLINE = "Field Sales Intelligence";
