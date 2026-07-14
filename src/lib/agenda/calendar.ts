import type { AgendaItem } from "@/lib/constants/agenda";

export interface AgendaDateRange {
  startIso: string;
  endIso: string;
  label: string;
}

export function parseReferenceDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = parseReferenceDate(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function shiftMonthDateKey(dateKey: string, months: number): string {
  const date = parseReferenceDate(dateKey);
  date.setMonth(date.getMonth() + months);
  return toDateKey(date);
}

export function scheduledAtToDateKey(iso: string): string {
  return toDateKey(new Date(iso));
}

export function getDayRange(dateKey: string): AgendaDateRange {
  const start = parseReferenceDate(dateKey);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const label = start.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

export function getWeekRange(dateKey: string): AgendaDateRange {
  const reference = parseReferenceDate(dateKey);
  const dayOfWeek = (reference.getDay() + 6) % 7;
  const start = new Date(reference);
  start.setDate(reference.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const label = `${start.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  })} – ${end.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

export function getMonthRange(dateKey: string): AgendaDateRange {
  const reference = parseReferenceDate(dateKey);
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  const label = start.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

export function resolveAgendaRange(
  view: "day" | "week" | "month",
  dateKey: string
): AgendaDateRange {
  if (view === "week") {
    return getWeekRange(dateKey);
  }
  if (view === "month") {
    return getMonthRange(dateKey);
  }
  return getDayRange(dateKey);
}

export function buildMonthDays(referenceDateKey: string): Date[] {
  const reference = parseReferenceDate(referenceDateKey);
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    days.push(day);
  }

  return days;
}

export function buildWeekDays(referenceDateKey: string): Date[] {
  const range = getWeekRange(referenceDateKey);
  const start = parseReferenceDate(referenceDateKey);
  const dayOfWeek = (start.getDay() + 6) % 7;
  const weekStart = parseReferenceDate(referenceDateKey);
  weekStart.setDate(start.getDate() - dayOfWeek);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });
}

export function groupAgendaItemsByDay(items: AgendaItem[]): Map<string, AgendaItem[]> {
  const groups = new Map<string, AgendaItem[]>();

  for (const item of items) {
    const dayKey = scheduledAtToDateKey(item.scheduledAt);
    const current = groups.get(dayKey) ?? [];
    current.push(item);
    groups.set(dayKey, current);
  }

  for (const [key, dayItems] of groups) {
    dayItems.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
    groups.set(key, dayItems);
  }

  return groups;
}

export function isSameMonth(date: Date, referenceDateKey: string): boolean {
  const reference = parseReferenceDate(referenceDateKey);
  return date.getMonth() === reference.getMonth() && date.getFullYear() === reference.getFullYear();
}

export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(new Date());
}
