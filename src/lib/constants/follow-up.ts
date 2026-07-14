import type { ContactHistoryType } from "./contact-history";

export const FOLLOW_UP_STATUSES = ["todo", "completed", "postponed", "cancelled"] as const;

export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  todo: "Da fare",
  completed: "Completato",
  postponed: "Rimandato",
  cancelled: "Annullato",
};

export const FOLLOW_UP_STATUS_OPTIONS = FOLLOW_UP_STATUSES.map((value) => ({
  value,
  label: FOLLOW_UP_STATUS_LABELS[value],
}));

export const FOLLOW_UP_PRIORITIES = ["low", "medium", "high"] as const;

export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITIES)[number];

export const FOLLOW_UP_PRIORITY_LABELS: Record<FollowUpPriority, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

export const FOLLOW_UP_PRIORITY_OPTIONS = FOLLOW_UP_PRIORITIES.map((value) => ({
  value,
  label: FOLLOW_UP_PRIORITY_LABELS[value],
}));

export const FOLLOW_UP_PERIOD_OPTIONS = [
  { value: "", label: "Tutto il periodo" },
  { value: "today", label: "Oggi" },
  { value: "next7", label: "Prossimi 7 giorni" },
  { value: "week", label: "Questa settimana" },
  { value: "overdue", label: "Scaduti" },
] as const;

export type FollowUpPeriod = (typeof FOLLOW_UP_PERIOD_OPTIONS)[number]["value"];

const FOLLOW_UP_STATUS_SET = new Set<string>(FOLLOW_UP_STATUSES);
const FOLLOW_UP_PRIORITY_SET = new Set<string>(FOLLOW_UP_PRIORITIES);

export function isFollowUpStatus(value: string | undefined): value is FollowUpStatus {
  return value != null && FOLLOW_UP_STATUS_SET.has(value);
}

export function isFollowUpPriority(value: string | undefined): value is FollowUpPriority {
  return value != null && FOLLOW_UP_PRIORITY_SET.has(value);
}

export function isFollowUpPeriod(value: string | undefined): value is FollowUpPeriod {
  return FOLLOW_UP_PERIOD_OPTIONS.some((option) => option.value === (value ?? ""));
}

export function isActivitiesSection(value: string | undefined): value is "history" | "followups" {
  return value === "history" || value === "followups";
}

export function isFollowUpView(value: string | undefined): value is "list" | "calendar" {
  return value === "list" || value === "calendar";
}

export function isFollowUpActivityType(value: string): value is ContactHistoryType {
  return ["call", "whatsapp", "email", "visit", "quote", "note"].includes(value);
}

export function getFollowUpEffectiveDate(item: {
  status: FollowUpStatus;
  scheduled_at: string;
  postponed_to: string | null;
}): string {
  if (item.status === "postponed" && item.postponed_to) {
    return item.postponed_to;
  }
  return item.scheduled_at;
}
