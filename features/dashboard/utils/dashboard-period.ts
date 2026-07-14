import type { DashboardPeriod } from "@/lib/constants/dashboard-filters";

export interface DashboardPeriodRange {
  startIso: string;
  endIso: string;
  label: string;
}

export function resolveDashboardPeriodRange(period: DashboardPeriod): DashboardPeriodRange | null {
  if (!period) {
    return null;
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      start.setDate(start.getDate() - 89);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
    case "12m":
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    default:
      return null;
  }

  start.setHours(0, 0, 0, 0);

  const label =
    period === "7d"
      ? "7 giorni"
      : period === "30d"
        ? "30 giorni"
        : period === "90d"
          ? "90 giorni"
          : period === "ytd"
            ? "anno corrente"
            : "12 mesi";

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

export function monthKeysInRange(range: DashboardPeriodRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.startIso);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(range.endIso);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}
