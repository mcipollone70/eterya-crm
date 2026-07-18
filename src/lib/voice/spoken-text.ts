import {
  JOY_SPOKEN_MAX_CHARS,
  JOY_SPOKEN_TARGET_CHARS,
} from "./joy-voice-profile";

export interface JoyUtteranceParts {
  /** Testo completo mostrato in UI (invariato). */
  displayText: string;
  /** Blocco breve, naturale, conversazionale da sintetizzare. */
  spokenText: string;
}

const HOUR_WORDS: Record<number, string> = {
  0: "mezzanotte",
  1: "l'una",
  2: "le due",
  3: "le tre",
  4: "le quattro",
  5: "le cinque",
  6: "le sei",
  7: "le sette",
  8: "le otto",
  9: "le nove",
  10: "le dieci",
  11: "le undici",
  12: "mezzogiorno",
  13: "le tredici",
  14: "le quattordici",
  15: "le quindici",
  16: "le sedici",
  17: "le diciassette",
  18: "le diciotto",
  19: "le diciannove",
  20: "le venti",
  21: "le ventuno",
  22: "le ventidue",
  23: "le ventitre",
};

const MINUTE_WORDS: Record<number, string> = {
  0: "",
  15: "e un quarto",
  30: "e mezza",
  45: "e tre quarti",
};

const ACRONYM_MAP: Array<[RegExp, string]> = [
  [/\bP\.?\s*IVA\b/gi, "partita I VA"],
  [/\bC\.?\s*F\.?\b/gi, "codice fiscale"],
  [/\bPEC\b/g, "pec"],
  [/\bS\.?\s*r\.?\s*l\.?\b/gi, "esse erre elle"],
  [/\bS\.?\s*p\.?\s*A\.?\b/gi, "esse pi a"],
  [/\bS\.?\s*n\.?\s*c\.?\b/gi, "esse enne ci"],
  [/\bSPA\b/g, "esse pi a"],
  [/\bSRL\b/g, "esse erre elle"],
  [/\bVAT\b/g, "V A T"],
  [/\bGPS\b/g, "G P S"],
  [/\bPDF\b/g, "P D F"],
  [/\bURL\b/g, "indirizzo web"],
  [/\bAPI\b/g, "A P I"],
  [/\bCRM\b/g, "C R M"],
  [/\bKPI\b/g, "K P I"],
  [/\bOK\b/g, "ok"],
  [/\bvs\.?\b/gi, "contro"],
  [/\betc\.?\b/gi, "e così via"],
  [/\bn°\s*/gi, "numero "],
  [/\bN\.\s*/g, "numero "],
];

function formatItalianHour(hour: number, minute: number): string {
  const h = ((hour % 24) + 24) % 24;
  const base = HOUR_WORDS[h] ?? `le ${h}`;
  if (minute === 0) {
    return base;
  }
  const special = MINUTE_WORDS[minute];
  if (special) {
    return `${base} ${special}`;
  }
  if (minute < 10) {
    return `${base} e zero ${minute}`;
  }
  return `${base} e ${minute}`;
}

function expandItalianTimes(text: string): string {
  return text
    .replace(
      /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,
      (_m, hh: string, mm: string) =>
        formatItalianHour(Number(hh), Number(mm))
    )
    .replace(
      /\balle\s+(\d{1,2})(?!\d)/gi,
      (_m, hh: string) => {
        const n = Number(hh);
        if (n >= 0 && n <= 23) {
          return formatItalianHour(n, 0);
        }
        return _m;
      }
    );
}

function expandAcronyms(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ACRONYM_MAP) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function mergeShortSentences(sentences: string[]): string[] {
  const merged: string[] = [];
  for (const sentence of sentences) {
    const cleaned = sentence.trim();
    if (!cleaned) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      (prev.length < 48 || !/[.!?]$/.test(prev)) &&
      cleaned.length < 70
    ) {
      const joiner = /[,;:]$/.test(prev) ? " " : ", ";
      merged[merged.length - 1] = `${prev.replace(/[.!?]$/, "")}${joiner}${cleaned.replace(/^[a-zàèéìòù]/, (c) => c.toLowerCase())}`;
      continue;
    }
    merged.push(cleaned);
  }
  return merged;
}

function limitConversationalSentences(
  sentences: string[],
  maxChars: number
): string {
  const meaningful = sentences.filter((s) => s.replace(/[.!?]/g, "").trim().length >= 12);
  const pool = meaningful.length > 0 ? meaningful : sentences;
  let spoken = "";
  let count = 0;
  const softMaxSentences = 4;

  for (const sentence of pool) {
    const cleaned = sentence.trim();
    if (!cleaned) continue;
    const next = spoken ? `${spoken} ${cleaned}` : cleaned;
    if (next.length > maxChars || count >= softMaxSentences) {
      break;
    }
    spoken = next;
    count += 1;
  }

  if (!spoken && pool[0]) {
    spoken = pool[0].slice(0, maxChars).trim();
  }

  return spoken;
}

/**
 * Separazione centrale display vs parlato.
 * displayText resta invariato; spokenText è breve e conversazionale.
 */
export function prepareJoyUtterance(
  displayText: string,
  maxChars = JOY_SPOKEN_TARGET_CHARS
): JoyUtteranceParts {
  const display = displayText ?? "";
  return {
    displayText: display,
    spokenText: sanitizeSpokenText(display, maxChars),
  };
}

/**
 * Pulisce e rende naturale il testo per un'unica sintesi TTS continua.
 */
export function sanitizeSpokenText(
  raw: string,
  maxChars = JOY_SPOKEN_TARGET_CHARS
): string {
  if (!raw?.trim()) {
    return "";
  }

  const hardMax = Math.min(Math.max(maxChars, 80), JOY_SPOKEN_MAX_CHARS);

  let text = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.-]+\.(com|it|io|net|org|app)(\/\S*)?/gi, " ")
    .replace(/\[[^\]]*\]\(([^)]+)\)/g, "$1")
    .replace(/^\s*\|.*\|.*$/gm, " ")
    .replace(/^\s*[-*•▪▸►]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\u2026|\.{3,}/g, ".")
    .replace(/[—–]+/g, ", ")
    .replace(/\s*:\s*/g, ", ")
    .replace(/\s*;\s*/g, ", ")
    .replace(/[«»""„']/g, "")
    .replace(/\s*\(\s*/g, ", ")
    .replace(/\s*\)\s*/g, " ")
    .replace(/[!?]{2,}/g, (m) => m[0] ?? "!")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([.!?])\s*([.!?])/g, "$1 ")
    .trim();

  text = expandItalianTimes(text);
  text = expandAcronyms(text);

  text = text
    .replace(/\s+/g, " ")
    .replace(/^[.,\s]+/, "")
    .replace(/\s+([,.!?])/g, "$1")
    // Evita punti dopo frammenti di una sola parola
    .replace(/\b(\w{1,3})\.\s+(?=[a-zàèéìòù])/g, "$1 ")
    .trim();

  if (!text) {
    return "";
  }

  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences = mergeShortSentences(rawSentences);
  let spoken = limitConversationalSentences(sentences, hardMax);

  if (!spoken) {
    spoken = text.slice(0, hardMax).trim();
  }

  if (spoken.length > hardMax) {
    const cut = spoken.slice(0, hardMax);
    const lastSpace = cut.lastIndexOf(" ");
    spoken =
      lastSpace > hardMax * 0.55
        ? `${cut.slice(0, lastSpace).trim()}.`
        : `${cut.trim()}.`;
  }

  // Una sola utterance continua
  spoken = spoken.replace(/\s+/g, " ").trim();

  // Se abbiamo tagliato un report lungo senza domanda, chiudi in modo naturale
  if (
    raw.length > hardMax * 1.6 &&
    spoken.length >= 40 &&
    !/[?]$/.test(spoken) &&
    !/vuoi|dimmi|preferisci|conferma/i.test(spoken)
  ) {
    const base = spoken.replace(/[.!]\s*$/, "");
    spoken = `${base}. Vuoi che ti dica altro?`;
    if (spoken.length > hardMax + 40) {
      spoken = `${base}.`;
    }
  }

  return spoken;
}

/** Alias storico usato dalle schermate Joy. */
export function buildSpokenSummary(
  content: string,
  maxChars = JOY_SPOKEN_TARGET_CHARS
): string {
  return sanitizeSpokenText(content, maxChars);
}
