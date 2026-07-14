const WEEKDAY_INDEX: Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function applyTime(text: string, date: Date): Date {
  const result = new Date(date);
  const timeMatch = text.match(/alle\s+(\d{1,2})(?:[:.](\d{2}))?/i);
  if (timeMatch) {
    result.setHours(Number(timeMatch[1]), Number(timeMatch[2] ?? 0), 0, 0);
    return result;
  }
  result.setHours(9, 0, 0, 0);
  return result;
}

function nextWeekday(targetDay: number, reference: Date): Date {
  const result = new Date(reference);
  const currentDay = result.getDay();
  let delta = targetDay - currentDay;
  if (delta <= 0) {
    delta += 7;
  }
  result.setDate(result.getDate() + delta);
  return result;
}

function addDays(reference: Date, days: number): Date {
  const result = new Date(reference);
  result.setDate(result.getDate() + days);
  return result;
}

/** Interpreta espressioni italiane comuni (domani, venerdì, tra 20 giorni, alle 15). */
export function parseItalianSchedule(text: string, reference = new Date()): Date | null {
  const normalized = normalize(text);
  if (!normalized) {
    return null;
  }

  const daysMatch = normalized.match(/tra\s+(\d+)\s+giorni?/);
  if (daysMatch) {
    return applyTime(normalized, addDays(reference, Number(daysMatch[1])));
  }

  const weeksMatch = normalized.match(/tra\s+(\d+)\s+settiman/);
  if (weeksMatch) {
    return applyTime(normalized, addDays(reference, Number(weeksMatch[1]) * 7));
  }

  if (/dopodomani/.test(normalized)) {
    return applyTime(normalized, addDays(reference, 2));
  }

  if (/domani/.test(normalized)) {
    return applyTime(normalized, addDays(reference, 1));
  }

  if (/oggi/.test(normalized)) {
    return applyTime(normalized, reference);
  }

  for (const [name, dayIndex] of Object.entries(WEEKDAY_INDEX)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      return applyTime(normalized, nextWeekday(dayIndex, reference));
    }
  }

  const timeOnly = normalized.match(/alle\s+(\d{1,2})(?:[:.](\d{2}))?/);
  if (timeOnly) {
    return applyTime(normalized, reference);
  }

  return null;
}

export function formatItalianScheduleLabel(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
