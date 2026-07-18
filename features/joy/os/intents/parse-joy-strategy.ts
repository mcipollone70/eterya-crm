/**
 * Strategy + learning intent detectors (no dependency on parseJoyIntent).
 */

import type { JoyStrategyFocus, JoyStrategyRequest } from "../types";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Detect strategic commercial questions that should route to the strategy engine.
 */
export function parseJoyStrategyRequest(message: string): JoyStrategyRequest | null {
  const text = normalize(message);
  if (!text) return null;

  const softStrategy =
    /come\s+vend|come\s+chiudere|come\s+recuper|dove\s+investire|quale\s+strateg/.test(text);

  const isStrategy =
    softStrategy ||
    /aumentare\s+(?:il\s+)?fatturato|incrementare\s+(?:le\s+)?vendite|vendere\s+di\s+piu|spingere\s+(?:le\s+)?vendite/.test(
      text
    ) ||
    /recuperare\s+(?:i\s+)?clienti\s+(?:persi|inattivi)/.test(text) ||
    /strategia\s+commerciale|piano\s+commerciale|piano\s+mensile|strategia\s+settimanale/.test(
      text
    ) ||
    /(?:arrivare|raggiungere)\s+(?:a\s+)?(?:\d|100\s*k|100k)|obiettivo\s+\d|100\s*k|100k/.test(
      text
    ) ||
    /vendere\s+piu\s+vepa|spingere\s+vepa|piu\s+vepa|voglio\s+vendere\s+vepa|vendere\s+vepa/.test(
      text
    ) ||
    /(?:oggi|stasera|questa\s+settimana).*(?:vendere|spingere).*(?:vepa|zanzarier|tapparell)/.test(
      text
    ) ||
    /(?:vendere|spingere).*(?:vepa|zanzarier|tapparell).*(?:oggi|stasera|settimana)/.test(
      text
    ) ||
    (/showroom/.test(text) && /(?:piano|strateg|portare|clienti)/.test(text)) ||
    (/come\s+(?:posso|possiamo|faccio)/.test(text) &&
      /(?:fatturato|vendite|vepa|clienti\s+persi|pipeline|zona|latina|showroom)/.test(text));

  if (!isStrategy) {
    return null;
  }

  let focus: JoyStrategyFocus = "general";
  let productFamily: string | null = null;
  let zone: string | null = null;
  let amount: number | null = null;
  let period: "week" | "month" | "year" | null = null;

  if (/\bvepa\b/.test(text)) {
    focus = "product_family";
    productFamily = "vepa";
  } else if (/zanzarier/.test(text)) {
    focus = "product_family";
    productFamily = "zanzariere";
  } else if (/tapparell/.test(text)) {
    focus = "product_family";
    productFamily = "tapparelle";
  } else if (/cristal/.test(text)) {
    focus = "product_family";
    productFamily = "tende_cristal";
  }

  if (/showroom|punto\s+vendita/.test(text)) {
    focus = "showroom";
  }

  if (/clienti\s+persi|recuperare\s+clienti|inattivi/.test(text)) {
    focus = "lost_clients";
  }

  if (/fatturato|revenue|aumentare\s+vendite|incrementare/.test(text) && focus === "general") {
    focus = "revenue";
  }

  const zoneMatch =
    message.match(
      /(?:zona|in|su|focus(?:\s+su)?)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{2,30})/i
    ) ?? null;
  if (zoneMatch?.[1]) {
    const candidate = zoneMatch[1].trim().replace(/[?.!,]+$/, "");
    if (
      candidate.length > 2 &&
      !/^(fatturato|vendite|vepa|clienti|mese|settimana|anno|piu|più)$/i.test(candidate)
    ) {
      zone = candidate;
      if (focus === "general" || focus === "revenue") {
        focus = "zone";
      }
    }
  }

  for (const known of ["latina", "sezze", "terracina", "formia", "aprilia", "roma"]) {
    if (text.includes(known) && !zone) {
      zone = known.charAt(0).toUpperCase() + known.slice(1);
      if (focus === "general" || focus === "revenue") {
        focus = "zone";
      }
    }
  }

  const amountMatch =
    text.match(/(\d+(?:[.,]\d+)?)\s*(k|mila)?/) ??
    message.match(/(\d+(?:[.,]\d+)?)\s*(k|mila)?\s*(?:€|euro)?/i);
  if (
    amountMatch?.[1] &&
    (/obiettivo|arrivare|raggiungere|fatturare|100k|target/.test(text) ||
      /k\b|mila/.test(amountMatch[0]))
  ) {
    let value = Number(amountMatch[1].replace(",", "."));
    if ((amountMatch[2] ?? "").startsWith("k") || (amountMatch[2] ?? "").startsWith("mila")) {
      value *= 1000;
    }
    if (/100k|100\s*k/.test(text)) {
      value = 100_000;
    }
    if (Number.isFinite(value) && value >= 1000) {
      amount = value;
      focus = "sales_goal";
      period = /settiman/.test(text)
        ? "week"
        : /ann[oi]/.test(text)
          ? "year"
          : "month";
    }
  }

  if (/piano\s+mensile|strategia\s+mensile|mese\s+commercial/.test(text) && focus === "general") {
    focus = "revenue";
  }

  return {
    focus,
    productFamily,
    zone,
    amount,
    period,
  };
}

export function isAgentLearningIntent(message: string): boolean {
  const text = normalize(message);
  return (
    /apprendiment|i miei pattern|come lavoro|le mie abitudini|punti di forza|inefficienz|cosa\s+impari\s+da\s+me|analisi\s+agente/.test(
      text
    )
  );
}
