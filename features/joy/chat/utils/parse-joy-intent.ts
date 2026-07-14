import type { ProductFamily } from "@/lib/constants/product-catalog";

export type JoyIntent =
  | { type: "visits_today" }
  | { type: "inactive_clients"; days: number }
  | { type: "opportunities_min_amount"; amount: number }
  | { type: "product_interest"; family: ProductFamily }
  | { type: "optimize_tour" }
  | { type: "nearby_city"; city: string }
  | { type: "open_company"; query: string }
  | { type: "follow_ups_overdue" }
  | { type: "agenda_today" }
  | { type: "radar" }
  | { type: "calendar_status" }
  | { type: "pipeline_summary" }
  | { type: "contacts_summary" }
  | { type: "help" }
  | { type: "unknown" };

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function extractAmount(text: string): number | null {
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");
  const match =
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:€|euro|eur)/i) ??
    normalized.match(/(?:sopra|oltre|piu di|più di|minimo)\s*(\d+(?:\.\d+)?)/i) ??
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

function extractCity(text: string): string | null {
  const match = text.match(
    /(?:vicino a|vicini a|intorno a|zona di|clienti a|aziende a|a)\s+([a-zàèéìòù\s'-]{2,40})/i
  );
  if (!match) {
    return null;
  }
  return match[1].trim().replace(/[?.!]+$/, "");
}

function extractCompanyQuery(text: string): string | null {
  const patterns = [
    /(?:apri|mostra|scheda|briefing|visita)\s+(.+)/i,
    /(?:cliente|azienda)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[?.!]+$/, "");
    }
  }

  return null;
}

function extractInactiveDays(text: string): number {
  if (/un anno|1 anno|12 mesi/.test(text)) {
    return 365;
  }
  if (/sei mesi|6 mesi/.test(text)) {
    return 180;
  }
  if (/tre mesi|3 mesi/.test(text)) {
    return 90;
  }

  const match = text.match(/(\d+)\s*(giorni|mesi|anni)/i);
  if (!match) {
    return 365;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("ann")) {
    return value * 365;
  }
  if (unit.startsWith("mes")) {
    return value * 30;
  }
  return value;
}

export function parseJoyIntent(message: string): JoyIntent {
  const text = normalize(message);

  if (!text) {
    return { type: "help" };
  }

  if (/^(ciao|buongiorno|salve|help|aiuto|cosa puoi)/.test(text)) {
    return { type: "help" };
  }

  if (/chi devo visitare|visite oggi|visitare oggi|devo andare oggi/.test(text)) {
    return { type: "visits_today" };
  }

  if (/agenda|appuntament/.test(text) && /oggi/.test(text)) {
    return { type: "agenda_today" };
  }

  if (/follow.?up|richiami|richiamare/.test(text) && /(scadut|in ritardo|overdue)/.test(text)) {
    return { type: "follow_ups_overdue" };
  }

  if (/non vedo|inattiv|non visitat|mai visitat|da quanto/.test(text)) {
    return { type: "inactive_clients", days: extractInactiveDays(text) };
  }

  if (/opportunit/.test(text) && /(sopra|oltre|€|euro|valore|pipeline)/.test(text)) {
    return {
      type: "opportunities_min_amount",
      amount: extractAmount(message) ?? 10_000,
    };
  }

  if (/pipeline/.test(text)) {
    return { type: "pipeline_summary" };
  }

  if (/\bvepa\b/.test(text)) {
    return { type: "product_interest", family: "vepa" };
  }

  if (/zanzarier/.test(text)) {
    return { type: "product_interest", family: "zanzariere" };
  }

  if (/tapparelle|tapparella/.test(text)) {
    return { type: "product_interest", family: "tapparelle" };
  }

  if (/organizza.*giro|giro migliore|giro visite|ottimizza.*giro/.test(text)) {
    return { type: "optimize_tour" };
  }

  if (/radar/.test(text)) {
    return { type: "radar" };
  }

  if (/google calendar|calendario/.test(text)) {
    return { type: "calendar_status" };
  }

  if (/contatt/.test(text) && !/richiam/.test(text)) {
    return { type: "contacts_summary" };
  }

  if (/vicino a|vicini a|intorno a|zona di|clienti a\s|aziende a\s/.test(text)) {
    const city = extractCity(message);
    if (city) {
      return { type: "nearby_city", city };
    }
  }

  const companyQuery = extractCompanyQuery(message);
  if (companyQuery) {
    return { type: "open_company", query: companyQuery };
  }

  return { type: "unknown" };
}
