import { parseItalianSchedule } from "./parse-italian-schedule";

export type JoyCopilotIntent =
  | { type: "create_visit"; companyQuery: string | null; scheduleText: string }
  | { type: "update_visit"; companyQuery: string | null; scheduleText: string }
  | { type: "cancel_visit"; companyQuery: string | null }
  | {
      type: "create_follow_up";
      companyQuery: string | null;
      scheduleText: string;
      description: string | null;
    }
  | { type: "update_follow_up"; companyQuery: string | null; scheduleText: string }
  | {
      type: "create_reminder";
      title: string | null;
      scheduleText: string;
      companyQuery: string | null;
    }
  | { type: "create_opportunity"; companyQuery: string | null; title: string | null }
  | { type: "create_quote"; companyQuery: string | null; title: string | null }
  | { type: "create_order"; companyQuery: string | null; title: string | null }
  | { type: "create_sample"; companyQuery: string | null; title: string | null }
  | { type: "create_service_ticket"; companyQuery: string | null; title: string | null }
  | { type: "create_note"; companyQuery: string | null; notes: string }
  | { type: "open_company"; query: string }
  | { type: "open_opportunities"; minAmount: number | null }
  | { type: "open_agenda"; scheduleText: string | null }
  | { type: "open_routes"; scheduleText: string | null }
  | { type: "open_radar" };

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function isCopilotCommand(text: string): boolean {
  return /(?:pianifica|programma|crea|fissa|sposta|rimanda|posticipa|modifica|annulla|cancella|elimina|apri|mostrami|fammi vedere|organizza|vai)\b/.test(
    text
  );
}

function extractAmount(text: string): number | null {
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");
  const match =
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:€|euro|eur)/i) ??
    normalized.match(/(?:oltre|sopra|piu di|più di)\s*(\d+(?:\.\d+)?)/i) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*k\b/i);

  if (!match) {
    return null;
  }

  let value = Number(match[1]);
  if (/k\b/i.test(match[0])) {
    value *= 1000;
  }
  return Number.isFinite(value) ? value : null;
}

function stripSchedulePhrases(text: string): string {
  return text
    .replace(
      /\b(?:domani|oggi|dopodomani|tra\s+\d+\s+(?:giorni?|settiman[ae]?)|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|alle\s+\d{1,2}(?:[:.]\d{2})?)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompanyAfterPreposition(message: string): string | null {
  const match = message.match(
    /(?:da|di|per|presso|cliente|azienda)\s+([a-zàèéìòù0-9][a-zàèéìòù0-9\s&.'-]{1,60})/i
  );
  if (!match?.[1]) {
    return null;
  }
  return stripSchedulePhrases(match[1]).replace(/[?.!]+$/, "").trim() || null;
}

function extractCompanyFromOpen(message: string): string | null {
  const patterns = [
    /(?:apri|mostra|vai a|scheda)\s+(?:l[''])?(?:azienda|cliente)\s+(.+)/i,
    /(?:apri|mostra)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const cleaned = stripSchedulePhrases(match[1]).replace(/[?.!]+$/, "").trim();
      if (cleaned && !/^(agenda|opportunit|radar|giro|mappa|routes?)$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return null;
}

function extractScheduleText(message: string): string {
  const normalized = normalize(message);
  const chunks: string[] = [];

  if (/dopodomani/.test(normalized)) {
    chunks.push("dopodomani");
  } else if (/domani/.test(normalized)) {
    chunks.push("domani");
  } else if (/oggi/.test(normalized)) {
    chunks.push("oggi");
  }

  const weekday = normalized.match(
    /\b(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)\b/
  );
  if (weekday) {
    chunks.push(weekday[1]);
  }

  const offset = normalized.match(/tra\s+(\d+)\s+(giorni?|settiman[ae]?)/);
  if (offset) {
    chunks.push(`tra ${offset[1]} ${offset[2]}`);
  }

  const time = message.match(/alle\s+\d{1,2}(?:[:.]\d{2})?/i);
  if (time) {
    chunks.push(time[0]);
  }

  return chunks.join(" ");
}

export function parseJoyCopilotIntent(message: string): JoyCopilotIntent | null {
  const text = normalize(message);
  if (!text || !isCopilotCommand(text)) {
    return null;
  }

  const scheduleText = extractScheduleText(message);

  if (/(?:annulla|cancella|elimina).*(?:visita)/.test(text)) {
    return {
      type: "cancel_visit",
      companyQuery: extractCompanyAfterPreposition(message),
    };
  }

  if (/(?:sposta|rimanda|posticipa|modifica).*(?:visita)/.test(text)) {
    return {
      type: "update_visit",
      companyQuery: extractCompanyAfterPreposition(message),
      scheduleText,
    };
  }

  if (/(?:pianifica|programma|crea|fissa).*(?:visita)/.test(text)) {
    return {
      type: "create_visit",
      companyQuery: extractCompanyAfterPreposition(message),
      scheduleText,
    };
  }

  if (/(?:sposta|rimanda|posticipa|modifica).*(?:follow.?up|richiamo)/.test(text)) {
    return {
      type: "update_follow_up",
      companyQuery: extractCompanyAfterPreposition(message),
      scheduleText,
    };
  }

  if (/(?:crea|fissa|pianifica).*(?:follow.?up|richiamo)/.test(text)) {
    const companyQuery = extractCompanyAfterPreposition(message);
    return {
      type: "create_follow_up",
      companyQuery,
      scheduleText: scheduleText || "tra 7 giorni",
      description: null,
    };
  }

  if (/(?:crea|fissa|imposta).*(?:promemoria|reminder)/.test(text)) {
    const titleMatch = message.match(/promemoria\s+(.+?)(?:\s+(?:domani|oggi|alle|tra)|$)/i);
    return {
      type: "create_reminder",
      title: titleMatch?.[1]?.trim() ?? "Promemoria Joy",
      scheduleText: scheduleText || "domani alle 9",
      companyQuery: extractCompanyAfterPreposition(message),
    };
  }

  if (/(?:crea|apri|registra).*(?:preventivo)/.test(text)) {
    return {
      type: "create_quote",
      companyQuery: extractCompanyAfterPreposition(message),
      title: null,
    };
  }

  if (/(?:crea|apri|registra).*(?:ordine)/.test(text)) {
    return {
      type: "create_order",
      companyQuery: extractCompanyAfterPreposition(message),
      title: null,
    };
  }

  if (/(?:crea|apri|registra).*(?:opportunit)/.test(text)) {
    return {
      type: "create_opportunity",
      companyQuery: extractCompanyAfterPreposition(message),
      title: null,
    };
  }

  if (/(?:crea|registra|consegna).*(?:campione)/.test(text)) {
    return {
      type: "create_sample",
      companyQuery: extractCompanyAfterPreposition(message),
      title: null,
    };
  }

  if (/(?:crea|apri).*(?:ticket|assistenza)|(?:segnala).*(?:guasto|problema)/.test(text)) {
    return {
      type: "create_service_ticket",
      companyQuery: extractCompanyAfterPreposition(message),
      title: null,
    };
  }

  if (/(?:crea|aggiungi|scrivi).*(?:nota)/.test(text)) {
    const notesMatch = message.match(/nota\s+(.+)/i);
    return {
      type: "create_note",
      companyQuery: extractCompanyAfterPreposition(message),
      notes: notesMatch?.[1]?.trim() || "Nota da Joy AI",
    };
  }

  if (/opportunit/.test(text) && /(?:fammi vedere|mostrami|apri|vedi)/.test(text)) {
    return {
      type: "open_opportunities",
      minAmount: extractAmount(message),
    };
  }

  if (/(?:apri|mostra|vai).*(?:giro\s+visite|routes)/.test(text)) {
    return { type: "open_routes", scheduleText: scheduleText || "domani" };
  }

  if (/(?:apri|mostra|vai).*(?:radar)/.test(text)) {
    return { type: "open_radar" };
  }

  if (/(?:apri|mostra|vai).*(?:agenda)/.test(text)) {
    return { type: "open_agenda", scheduleText: scheduleText || "oggi" };
  }

  const openCompany = extractCompanyFromOpen(message);
  if (openCompany) {
    return { type: "open_company", query: openCompany };
  }

  return null;
}

export function resolveScheduleIso(scheduleText: string, fallbackDays = 1): string {
  const parsed = parseItalianSchedule(scheduleText);
  if (parsed) {
    return parsed.toISOString();
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + fallbackDays);
  fallback.setHours(9, 0, 0, 0);
  return fallback.toISOString();
}
