export const COMPANY_DETAIL_TABS = [
  { id: "panoramica", label: "Panoramica" },
  { id: "attivita", label: "Attività" },
  { id: "visite", label: "Visite" },
  { id: "commerciale", label: "Commerciale" },
  { id: "prodotti", label: "Prodotti" },
  { id: "documenti", label: "Documenti" },
  { id: "mappa", label: "Mappa" },
  { id: "note", label: "Note" },
  { id: "statistiche", label: "Statistiche" },
] as const;

export type CompanyDetailTabId = (typeof COMPANY_DETAIL_TABS)[number]["id"];

const TAB_SET = new Set<string>(COMPANY_DETAIL_TABS.map((tab) => tab.id));

export function isCompanyDetailTab(value: string | undefined): value is CompanyDetailTabId {
  return value != null && TAB_SET.has(value);
}

export const DEFAULT_COMPANY_DETAIL_TAB: CompanyDetailTabId = "panoramica";

export const COMPANY_DETAIL_PERIOD_OPTIONS = [
  { value: "", label: "Sempre" },
  { value: "today", label: "Oggi" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
] as const;

export type CompanyDetailPeriod = (typeof COMPANY_DETAIL_PERIOD_OPTIONS)[number]["value"];

export function isCompanyDetailPeriod(value: string | undefined): value is CompanyDetailPeriod {
  return COMPANY_DETAIL_PERIOD_OPTIONS.some((option) => option.value === (value ?? ""));
}
