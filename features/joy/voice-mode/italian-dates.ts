/**
 * Parse relative Italian date phrases into ISO date (local noon).
 */

const WEEKDAY_MAP: Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
};

const IT_NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12,
  quindici: 15,
  venti: 20,
  trenta: 30,
};

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function parseItalianCount(token: string): number | null {
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  }
  return IT_NUMBER_WORDS[token] ?? null;
}

function atLocalNoon(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  const current = d.getDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(d, delta);
}

/**
 * Extract a relative/absolute Italian date from free text.
 * Returns ISO string or null.
 */
export function parseItalianRelativeDate(
  text: string,
  now: Date = new Date()
): string | null {
  const normalized = stripDiacritics(text.toLowerCase().trim());
  if (!normalized) return null;

  if (/\boggi\b/.test(normalized)) {
    return atLocalNoon(now);
  }
  if (/\bdomani\b/.test(normalized)) {
    return atLocalNoon(addDays(now, 1));
  }
  if (/\bdopo\s*domani\b/.test(normalized)) {
    return atLocalNoon(addDays(now, 2));
  }

  const inDays =
    normalized.match(/\btra\s+(\d+|[a-z]+)\s+giorn/i) ??
    normalized.match(/\btra\s+(\d+|[a-z]+)\s+d\b/i);
  if (inDays) {
    const n = parseItalianCount(inDays[1]!);
    if (n != null && n > 0 && n < 366) {
      return atLocalNoon(addDays(now, n));
    }
  }

  const inWeeks = normalized.match(/\btra\s+(\d+|[a-z]+)\s+settiman/i);
  if (inWeeks) {
    const n = parseItalianCount(inWeeks[1]!);
    if (n != null && n > 0 && n < 53) {
      return atLocalNoon(addDays(now, n * 7));
    }
  }

  for (const [name, weekday] of Object.entries(WEEKDAY_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      return atLocalNoon(nextWeekday(now, weekday));
    }
  }

  // dd/mm or dd-mm[-yyyy]
  const slash = normalized.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    let year = slash[3] ? Number(slash[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    ) {
      return d.toISOString();
    }
  }

  return null;
}

export function formatItalianDateSpoken(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}
