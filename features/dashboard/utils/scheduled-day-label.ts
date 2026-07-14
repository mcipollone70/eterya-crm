const ROME_TIME_ZONE = "Europe/Rome";

export function formatRomeDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTomorrowDateKeyInRome(reference: Date = new Date()): string {
  const todayKey = formatRomeDateKey(reference);
  const [year, month, day] = todayKey.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatScheduledDayLabel(scheduledAt: string): string {
  const visitKey = formatRomeDateKey(scheduledAt);
  const todayKey = formatRomeDateKey(new Date());

  if (visitKey === todayKey) {
    return "Oggi";
  }

  if (visitKey === getTomorrowDateKeyInRome()) {
    return "Domani";
  }

  const label = new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(scheduledAt));

  return label.charAt(0).toLocaleUpperCase("it-IT") + label.slice(1);
}

export function formatScheduledTimeLabel(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleTimeString("it-IT", {
    timeZone: ROME_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}
