export function daysSinceDate(dateValue: string | null | undefined): number | null {
  if (!dateValue) {
    return null;
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

export function formatVisitDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatVisitDateShort(value: string | null | undefined): string {
  if (!value) {
    return "Mai visitata";
  }

  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatLastVisitLabel(value: string | null | undefined): string {
  if (!value) {
    return "Mai visitata";
  }

  const days = daysSinceDate(value);
  if (days === null) {
    return formatVisitDateShort(value);
  }
  if (days === 0) {
    return "Oggi";
  }
  if (days === 1) {
    return "Ieri";
  }
  if (days < 30) {
    return `${days} giorni fa`;
  }

  return formatVisitDateShort(value);
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) {
    return "—";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${remainder} min`;
}

export function thresholdIsoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function endOfTodayIso(): string {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function startOfWeekIso(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
