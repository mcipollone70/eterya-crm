import type { ActivityType } from "@/lib/supabase/types";

export const CONTACT_HISTORY_TYPES = [
  "call",
  "whatsapp",
  "email",
  "visit",
  "quote",
  "note",
] as const;

export type ContactHistoryType = (typeof CONTACT_HISTORY_TYPES)[number];

export const CONTACT_HISTORY_TYPE_LABELS: Record<ContactHistoryType, string> = {
  call: "Telefonata",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visita",
  quote: "Preventivo",
  note: "Nota",
};

export const CONTACT_HISTORY_TYPE_OPTIONS = CONTACT_HISTORY_TYPES.map((value) => ({
  value,
  label: CONTACT_HISTORY_TYPE_LABELS[value],
}));

const CONTACT_HISTORY_TYPE_SET = new Set<string>(CONTACT_HISTORY_TYPES);

export function isContactHistoryType(value: string | undefined): value is ContactHistoryType {
  return value != null && CONTACT_HISTORY_TYPE_SET.has(value);
}

export function isContactHistoryActivityType(type: ActivityType): type is ContactHistoryType {
  return CONTACT_HISTORY_TYPE_SET.has(type);
}

export const CONTACT_HISTORY_PERIOD_OPTIONS = [
  { value: "", label: "Tutto il periodo" },
  { value: "today", label: "Oggi" },
  { value: "week", label: "Questa settimana" },
  { value: "month", label: "Questo mese" },
  { value: "quarter", label: "Ultimi 3 mesi" },
] as const;

export type ContactHistoryPeriod = (typeof CONTACT_HISTORY_PERIOD_OPTIONS)[number]["value"];

export function isContactHistoryPeriod(value: string | undefined): value is ContactHistoryPeriod {
  return CONTACT_HISTORY_PERIOD_OPTIONS.some((option) => option.value === (value ?? ""));
}

export const CONTACT_OUTCOME_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "neutro", label: "Neutro" },
  { value: "negativo", label: "Negativo" },
  { value: "non_risponde", label: "Non risponde" },
  { value: "richiamare", label: "Da richiamare" },
  { value: "ordine", label: "Ordine" },
  { value: "preventivo", label: "Preventivo inviato" },
] as const;

export const CONTACT_OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_OUTCOME_OPTIONS.map((option) => [option.value, option.label])
);

export function getContactOutcomeLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return CONTACT_OUTCOME_LABELS[value] ?? value;
}

export function getDefaultContactHistoryTitle(type: ContactHistoryType): string {
  return CONTACT_HISTORY_TYPE_LABELS[type];
}
