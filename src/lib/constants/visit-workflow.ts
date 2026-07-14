export const VISIT_PERIOD_OPTIONS = [
  { value: "today", label: "Oggi" },
  { value: "overdue", label: "Scadute" },
  { value: "upcoming", label: "Prossime" },
  { value: "week", label: "Settimana" },
  { value: "completed", label: "Completate" },
] as const;

export type VisitPeriod = (typeof VISIT_PERIOD_OPTIONS)[number]["value"];

const VISIT_PERIOD_SET = new Set<string>(VISIT_PERIOD_OPTIONS.map((option) => option.value));

export function isVisitPeriod(value: string | undefined): value is VisitPeriod {
  return value != null && VISIT_PERIOD_SET.has(value);
}

/** Apre il form registrazione visita sulla scheda azienda. */
export const COMPANY_REGISTER_VISIT_PARAM = "visit";

export function companyRegisterVisitHref(companyId: string): string {
  return `/companies/${companyId}?${COMPANY_REGISTER_VISIT_PARAM}=1`;
}
