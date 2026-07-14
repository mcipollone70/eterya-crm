import type { DashboardWidgetId } from "../types/commercial-dashboard";

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  description: string;
  category: "kpi" | "chart" | "widget";
  span: "kpi" | "chart" | "widget";
  href?: string;
}

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  "kpi-total-companies",
  "kpi-prospects",
  "kpi-clients",
  "kpi-ex-clients",
  "kpi-geocoded",
  "kpi-needs-review",
  "kpi-visits-today",
  "kpi-visits-week",
  "kpi-followups-today",
  "kpi-open-opportunities",
  "kpi-pipeline-value",
  "kpi-never-visited",
  "kpi-clients-inactive-90",
  "chart-province",
  "chart-commercial-status",
  "chart-visits-trend",
  "chart-opportunity-stage",
  "chart-product-interests",
  "chart-prospect-conversion",
  "widget-upcoming-appointments",
  "widget-overdue-activities",
  "widget-recent-contacts",
  "widget-top-opportunities",
  "widget-today-tour",
];

export const DASHBOARD_WIDGETS: Record<DashboardWidgetId, DashboardWidgetDefinition> = {
  "kpi-total-companies": {
    id: "kpi-total-companies",
    title: "Aziende totali",
    description: "Totale aziende in anagrafica",
    category: "kpi",
    span: "kpi",
    href: "/companies",
  },
  "kpi-prospects": {
    id: "kpi-prospects",
    title: "Prospect",
    description: "Aziende in stato prospect",
    category: "kpi",
    span: "kpi",
    href: "/companies?commercial_status=prospect",
  },
  "kpi-clients": {
    id: "kpi-clients",
    title: "Clienti",
    description: "Aziende clienti attive",
    category: "kpi",
    span: "kpi",
    href: "/companies?commercial_status=cliente",
  },
  "kpi-ex-clients": {
    id: "kpi-ex-clients",
    title: "Ex clienti",
    description: "Ex clienti in anagrafica",
    category: "kpi",
    span: "kpi",
    href: "/companies?commercial_status=ex_cliente",
  },
  "kpi-geocoded": {
    id: "kpi-geocoded",
    title: "Geolocalizzate",
    description: "Aziende con coordinate valide",
    category: "kpi",
    span: "kpi",
    href: "/maps",
  },
  "kpi-needs-review": {
    id: "kpi-needs-review",
    title: "Da verificare",
    description: "Geocodifiche da verificare",
    category: "kpi",
    span: "kpi",
    href: "/companies/geocoding/review",
  },
  "kpi-visits-today": {
    id: "kpi-visits-today",
    title: "Visite oggi",
    description: "Visite completate oggi",
    category: "kpi",
    span: "kpi",
    href: "/visits",
  },
  "kpi-visits-week": {
    id: "kpi-visits-week",
    title: "Visite settimana",
    description: "Visite completate questa settimana",
    category: "kpi",
    span: "kpi",
    href: "/visits",
  },
  "kpi-followups-today": {
    id: "kpi-followups-today",
    title: "Follow-up oggi",
    description: "Follow-up pianificati per oggi",
    category: "kpi",
    span: "kpi",
    href: "/activities?section=followups&fperiod=today",
  },
  "kpi-open-opportunities": {
    id: "kpi-open-opportunities",
    title: "Opportunità aperte",
    description: "Deal in pipeline attiva",
    category: "kpi",
    span: "kpi",
    href: "/opportunities",
  },
  "kpi-pipeline-value": {
    id: "kpi-pipeline-value",
    title: "Valore pipeline",
    description: "Valore opportunità aperte",
    category: "kpi",
    span: "kpi",
    href: "/opportunities",
  },
  "kpi-never-visited": {
    id: "kpi-never-visited",
    title: "Mai visitate",
    description: "Aziende senza alcuna visita",
    category: "kpi",
    span: "kpi",
    href: "/companies?last_visit=never",
  },
  "kpi-clients-inactive-90": {
    id: "kpi-clients-inactive-90",
    title: "Clienti inattivi 90gg",
    description: "Clienti senza visita da oltre 90 giorni",
    category: "kpi",
    span: "kpi",
    href: "/companies?last_visit=over_90&commercial_status=cliente",
  },
  "chart-province": {
    id: "chart-province",
    title: "Aziende per provincia",
    description: "Distribuzione geografica",
    category: "chart",
    span: "chart",
    href: "/companies",
  },
  "chart-commercial-status": {
    id: "chart-commercial-status",
    title: "Stato commerciale",
    description: "Distribuzione per stato commerciale",
    category: "chart",
    span: "chart",
    href: "/companies",
  },
  "chart-visits-trend": {
    id: "chart-visits-trend",
    title: "Andamento visite",
    description: "Visite completate ultimi 12 mesi",
    category: "chart",
    span: "chart",
    href: "/visits",
  },
  "chart-opportunity-stage": {
    id: "chart-opportunity-stage",
    title: "Opportunità per fase",
    description: "Distribuzione pipeline per fase",
    category: "chart",
    span: "chart",
    href: "/opportunities",
  },
  "chart-product-interests": {
    id: "chart-product-interests",
    title: "Prodotti di interesse",
    description: "Interessi prodotto per famiglia",
    category: "chart",
    span: "chart",
    href: "/products",
  },
  "chart-prospect-conversion": {
    id: "chart-prospect-conversion",
    title: "Conversione Prospect → Cliente",
    description: "Nuovi clienti e tasso di conversione",
    category: "chart",
    span: "chart",
    href: "/companies?commercial_status=cliente",
  },
  "widget-upcoming-appointments": {
    id: "widget-upcoming-appointments",
    title: "Prossimi appuntamenti",
    description: "Visite e follow-up in arrivo",
    category: "widget",
    span: "widget",
    href: "/visits",
  },
  "widget-overdue-activities": {
    id: "widget-overdue-activities",
    title: "Attività in ritardo",
    description: "Follow-up e attività scadute",
    category: "widget",
    span: "widget",
    href: "/activities?section=followups&fperiod=overdue",
  },
  "widget-recent-contacts": {
    id: "widget-recent-contacts",
    title: "Ultimi contatti",
    description: "Ultime attività di contatto",
    category: "widget",
    span: "widget",
    href: "/activities",
  },
  "widget-top-opportunities": {
    id: "widget-top-opportunities",
    title: "Migliori opportunità",
    description: "Deal aperti per valore",
    category: "widget",
    span: "widget",
    href: "/opportunities",
  },
  "widget-today-tour": {
    id: "widget-today-tour",
    title: "Giro visite di oggi",
    description: "Giri pianificati per oggi",
    category: "widget",
    span: "widget",
    href: "/routes",
  },
};

export function isDashboardWidgetId(value: string): value is DashboardWidgetId {
  return value in DASHBOARD_WIDGETS;
}

export function normalizeDashboardLayout(
  widgetOrder: string[] | null | undefined,
  hiddenWidgets: string[] | null | undefined
): { widgetOrder: DashboardWidgetId[]; hiddenWidgets: DashboardWidgetId[] } {
  const order = (widgetOrder ?? [])
    .filter(isDashboardWidgetId)
    .filter((id, index, array) => array.indexOf(id) === index);

  const hidden = (hiddenWidgets ?? []).filter(isDashboardWidgetId);

  const known = new Set<DashboardWidgetId>([...order, ...hidden]);
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!known.has(id)) {
      order.push(id);
    }
  }

  return { widgetOrder: order, hiddenWidgets: hidden };
}
