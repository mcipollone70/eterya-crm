import type { CommercialStatus } from "@/lib/supabase/types";
import type {
  JoyConversationMemory,
  JoyTourAudience,
  JoyTourDay,
  JoyTourIntakeField,
  JoyTourPlanDraft,
  JoyTourStartMode,
  JoyTourZoneMode,
} from "../types/joy-session";

export type {
  JoyTourDay,
  JoyTourAudience,
  JoyTourStartMode,
  JoyTourIntakeField,
  JoyTourZoneMode,
};

export type JoyTourSegmentFilter =
  | "falegnami"
  | "showroom"
  | "fabbri"
  | "prospect"
  | "clienti"
  | null;

export interface JoyTourPlanRequest {
  day: JoyTourDay;
  city: string | null;
  cap: string | null;
  province: string | null;
  zoneMode: JoyTourZoneMode | null;
  /** Raggio km per ricerca GPS (default 30). */
  radiusKm: number;
  /** Coordinate esplicite (alternativa al GPS dispositivo). */
  centerLat: number | null;
  centerLng: number | null;
  segment: JoyTourSegmentFilter;
  commercialStatus: CommercialStatus | null;
  audience: JoyTourAudience;
  maxStops: number;
  maxArrivalTime: string | null;
  startMode: JoyTourStartMode;
  startCity: string | null;
  endCity: string | null;
  /** Aziende da includere obbligatoriamente nelle tappe. */
  forceIncludeCompanyIds: string[];
  rawText: string;
  /** Campi esplicitamente forniti dall'utente (per saltare le domande). */
  provided: Partial<Record<JoyTourIntakeField | "segment", boolean>>;
}

export type JoyTourRuntimeCommand =
  | { type: "regenerate" }
  | { type: "skip"; companyQuery: string | null }
  | { type: "add"; companyQuery: string | null }
  | {
      type: "replace";
      removeQuery: string | null;
      addQuery: string | null;
    }
  | { type: "nearby_prospect" }
  | { type: "nearby_segment"; segment: Exclude<JoyTourSegmentFilter, null> }
  | { type: "avoid_traffic" }
  | { type: "arrive_by"; time: string }
  | { type: "next_stop" }
  | { type: "call_referent"; companyQuery: string | null }
  | { type: "open_maps" }
  | { type: "modify"; raw: string }
  | { type: "cancel_tour" };

/** Cap soft mid-tour: default 6 visite (intake può chiedere di più). */
export const JOY_TOUR_MID_MAX_STOPS = 6;

const PROVINCE_ALIASES: Record<string, string> = {
  lt: "LT",
  latina: "LT",
  fr: "FR",
  frosinone: "FR",
  rm: "RM",
  roma: "RM",
  rome: "RM",
  vt: "VT",
  viterbo: "VT",
  ri: "RI",
  rieti: "RI",
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function extractCap(text: string): string | null {
  const match = text.match(/\bCAP\s*(\d{5})\b/i) ?? text.match(/\b(\d{5})\b/);
  return match?.[1] ?? null;
}

function extractMaxStops(text: string): number | null {
  const wordMap: Record<string, number> = {
    due: 2,
    tre: 3,
    quattro: 4,
    cinque: 5,
    sei: 6,
    sette: 7,
    otto: 8,
    nove: 9,
    dieci: 10,
  };

  const wordMatch = text.match(
    /\b(due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b(?:\s+(?:visite|tappe|stop|clienti|prospect))?/i
  );
  if (wordMatch?.[1] && /visite|tappe|stop|clienti|prospect|trovami|trova|dammi|elenca|lista|mostrami|proponi|max|massimo|quante|numero/i.test(text)) {
    return wordMap[wordMatch[1].toLowerCase()] ?? null;
  }

  const fourSixEight = text.match(/\b([468])\b/);
  if (
    fourSixEight &&
    /visite|tappe|stop|clienti|prospect|quante|numero|max|massimo/i.test(text)
  ) {
    return Number(fourSixEight[1]);
  }

  const match =
    text.match(
      /(?:max|massimo|al massimo|fino a|trovami|trova|dammi)\s*(\d+)\s*(?:visite|tappe|stop|clienti|prospect)?/i
    ) ??
    text.match(/(\d+)\s*(?:visite|tappe|prospect|clienti)/i) ??
    text.match(/^(?:solo\s+)?(\d+)$/i);

  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return Math.min(12, Math.floor(value));
}

function extractMaxArrivalTime(text: string): string | null {
  const match =
    text.match(
      /(?:entro|entro le|fino alle|by|arriva(?:re)?(?:\s+entro)?(?:\s+le)?|entro\s+le)\s*(\d{1,2})(?:[:.](\d{2}))?/i
    ) ??
    text.match(/alle\s+(\d{1,2})(?:[:.](\d{2}))?\s*$/i) ??
    text.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*$/);

  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Indirizzo stradale (non comune): evita che «via Roma» diventi città «Roma». */
function isStreetLike(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^(via|viale|corso|piazza|piazzale|strada|vicolo|largo|contrada|localita|località)\b/i.test(
    value.trim()
  );
}

/** Città in coda a un indirizzo («via Roma 2, Latina»). */
function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  const match = address.match(
    /,\s*([A-Za-zÀ-ù][A-Za-zÀ-ù'-]{1,30}(?:\s+[A-Za-zÀ-ù][A-Za-zÀ-ù'-]{1,20}){0,2})\s*$/i
  );
  if (!match?.[1]) return null;
  const city = match[1].trim().replace(/[?.!,;:]+$/g, "");
  if (!city || isStreetLike(city)) return null;
  if (
    /^(oggi|domani|prospect|clienti|visite|giro|cap|alle|max|massimo|entrambi|gps|sede|provincia)$/i.test(
      city
    )
  ) {
    return null;
  }
  return city;
}

function extractStartEnd(message: string): { start: string | null; end: string | null } {
  // «fino alle 16:00» è vincolo orario, non destinazione geografica.
  const withoutTimeBound = message
    .replace(/\bfino\s+alle\s+\d{1,2}(?:[:.]\d{2})?\b/gi, " ")
    .replace(/\bentro\s+le\s+\d{1,2}(?:[:.]\d{2})?\b/gi, " ");

  const pair =
    withoutTimeBound.match(
      /(?:parto(?:\s+da)?|partenza(?:\s+da)?|inizio(?:\s+da)?|start)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})\s+(?:e\s+)?(?:fino a|arrivo a|fine|termin[oa]|end)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})/i
    ) ??
    withoutTimeBound.match(
      /da\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})\s+(?:a|fino a)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})/i
    );

  if (pair && !isStreetLike(pair[1])) {
    return {
      start: pair[1].trim().replace(/[?.!,]+$/, ""),
      end: pair[2].trim().replace(/[?.!,]+$/, ""),
    };
  }

  // Indirizzo completo: «Parto da via Roma 2, Latina»
  const streetStart = message.match(
    /(?:parto(?:\s+da)?|partenza(?:\s+da)?|inizio(?:\s+da)?)\s+((?:via|viale|corso|piazza|piazzale|strada|vicolo|largo|contrada)\s+[A-Za-zÀ-ù0-9'.-]+(?:\s+\d+[A-Za-z]?)?(?:\s*,\s*[A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})?)/i
  );
  if (streetStart?.[1]) {
    const endOnlyStreet = withoutTimeBound.match(
      /(?:fino a|arrivo a|destinazione|fine)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})/i
    );
    const cleanedStart = streetStart[1]
      .trim()
      .replace(/\s+e\s+(?:ho|sono|parto|arrivo).*$/i, "")
      .replace(/[?.!,;:]+$/g, "")
      .trim();
    return {
      start: cleanedStart,
      end: endOnlyStreet?.[1]?.trim().replace(/[?.!,]+$/, "") ?? null,
    };
  }

  const startOnly = message.match(
    /(?:parto(?:\s+da)?|partenza(?:\s+da)?|inizio(?:\s+da)?)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})/i
  );
  const endOnly = withoutTimeBound.match(
    /(?:fino a|arrivo a|destinazione|fine)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,30})/i
  );

  return {
    start: startOnly?.[1]?.trim().replace(/[?.!,]+$/, "") ?? null,
    end: endOnly?.[1]?.trim().replace(/[?.!,]+$/, "") ?? null,
  };
}

function extractCity(message: string, start: string | null, end: string | null): string | null {
  const cityStop =
    /^(che|mi|me|ci|ti|si|fino|alle|entro|con|per|oggi|domani|tengano|impegnato|impegnati|impegnino|impegnami|impegnano|visite|tappe|prospect|clienti|aziende|ore|minuti|e|o|ma|poi|dopo|prima|verso|presso|nella|nello|nel|dai|dagli|dalle|uno|una|un|il|la|lo|le|i|gli|da|di|in|a|al|alla|ai|agli|alle|su|sul|sulla|max|massimo|giro|tour|via|viale|corso|piazza)$/i;

  const clean = (raw: string): string | null => {
    const parts = raw
      .trim()
      .replace(/[?.!,;:]+$/g, "")
      .split(/\s+/)
      .filter(Boolean);
    const kept: string[] = [];
    for (const part of parts) {
      if (cityStop.test(part)) break;
      if (/^\d/.test(part)) break;
      kept.push(part);
      if (kept.length >= 3) break;
    }
    const city = kept.join(" ").trim();
    if (!city) return null;
    if (isStreetLike(city)) return null;
    if (/^roma$/i.test(city) && /via\s+roma/i.test(message)) {
      return null;
    }
    if (
      /^(oggi|domani|prospect|clienti|visite|giro|cap|alle|max|massimo|entrambi|gps|sede|provincia)$/i.test(
        city
      )
    ) {
      return null;
    }
    return city;
  };

  const startNorm = start?.toLowerCase().trim() ?? "";
  const endNorm = end?.toLowerCase().trim() ?? "";

  // Word boundary su a/di/in: evita che la «a» di «via» catturi «Roma».
  const patterns = [
    /(?:prospect|clienti|aziende|zona|comune)\s+\b(?:a|di|in)\b\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i,
    /(?:trovami|trova|dammi|elenca|lista|mostrami).*\b(?:a|di|in)\b\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i,
    /(?:zona|comune|\ba\b|\bin\b|\bdi\b)\s+([A-Za-zÀ-ù][A-Za-zÀ-ù\s'-]{1,40})/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const city = clean(match[1]);
    if (!city) continue;
    if (startNorm && city.toLowerCase() === startNorm) continue;
    if (endNorm && city.toLowerCase() === endNorm) continue;
    if (startNorm && startNorm.includes(city.toLowerCase()) && isStreetLike(start)) {
      continue;
    }
    return city;
  }

  const fromAddress = extractCityFromAddress(start) ?? extractCityFromAddress(
    message.match(
      /(?:parto(?:\s+da)?|partenza(?:\s+da)?|inizio(?:\s+da)?)\s+(.+?)(?:\.|$|\s+e\s+)/i
    )?.[1] ?? null
  );
  if (fromAddress) {
    return fromAddress;
  }

  return null;
}

function extractProvince(message: string): string | null {
  const explicit =
    message.match(
      /provincia(?:\s+di)?\s+([A-Za-zÀ-ù]{2,}(?:\s+[A-Za-zÀ-ù]{2,})?|\b[A-Za-z]{2}\b)/i
    ) ?? message.match(/\bprov\.?\s*([A-Za-z]{2})\b/i);
  if (explicit?.[1]) {
    const raw = normalize(explicit[1]).replace(/\s+/g, " ").trim();
    if (PROVINCE_ALIASES[raw]) {
      return PROVINCE_ALIASES[raw];
    }
    if (/^[a-z]{2}$/i.test(raw)) {
      return raw.toUpperCase();
    }
    return explicit[1].trim().replace(/[?.!,]+$/, "");
  }

  // Solo sigle isolate (es. «LT») — non confondere comuni (Latina, Roma) con province
  const alone = normalize(message).trim();
  if (/^[a-z]{2}$/i.test(alone) && PROVINCE_ALIASES[alone]) {
    return PROVINCE_ALIASES[alone];
  }
  return null;
}

/** Coordinate esplicite (lat, lng) tipiche Italia. */
function extractCoordinates(
  message: string
): { lat: number; lng: number } | null {
  const match = message.match(
    /(-?\d{1,2}[.,]\d{2,7})\s*[,;\s]\s*(-?\d{1,3}[.,]\d{2,7})/
  );
  if (!match) {
    return null;
  }
  const lat = Number(match[1].replace(",", "."));
  const lng = Number(match[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < 35 || lat > 48 || lng < 6 || lng > 19) {
    return null;
  }
  return { lat, lng };
}

function extractSegment(text: string): JoyTourSegmentFilter {
  if (/falegnam/.test(text)) {
    return "falegnami";
  }
  if (/showroom/.test(text)) {
    return "showroom";
  }
  if (/\bfabbr[io]\b|fabbro|ferrament/.test(text)) {
    return "fabbri";
  }
  if (/\bprospect\b/.test(text) && !/\bclient[ei]\b/.test(text)) {
    return "prospect";
  }
  if (/\bclient[ei]\b/.test(text) && !/ex\s*client/.test(text) && !/\bprospect\b/.test(text)) {
    return "clienti";
  }
  return null;
}

function extractAudience(text: string): JoyTourAudience | null {
  if (/entrambi|tutti|misto|prospect\s+e\s+client|client[ei]\s+e\s+prospect/.test(text)) {
    return "entrambi";
  }
  if (/\bprospect\b/.test(text) && !/\bclient[ei]\b/.test(text)) {
    return "prospect";
  }
  if (/\bclient[ei]\b/.test(text) && !/\bprospect\b/.test(text) && !/ex\s*client/.test(text)) {
    return "clienti";
  }
  return null;
}

function extractCommercialStatus(
  text: string,
  segment: JoyTourSegmentFilter,
  audience: JoyTourAudience | null
): CommercialStatus | null {
  if (audience === "prospect" || segment === "prospect") {
    return "prospect";
  }
  if (audience === "clienti" || segment === "clienti") {
    return "cliente";
  }
  if (/da\s+ricontatt/.test(text)) {
    return "da_ricontattare";
  }
  return null;
}

function extractDay(text: string): JoyTourDay | null {
  if (/oggi/.test(text) && !/domani/.test(text)) {
    return "today";
  }
  if (/domani/.test(text)) {
    return "tomorrow";
  }
  return null;
}

function extractStartMode(text: string): JoyTourStartMode | null {
  if (/\bgps\b|posizione\s+attuale|dove\s+sono|mia\s+posizione/.test(text)) {
    return "gps";
  }
  if (/sede(?:\s+eterya)?|ufficio|partenza\s+dalla\s+sede/.test(text)) {
    return "sede";
  }
  if (/ultima\s+posizion|last\s+position|dove\s+ero|ultima\s+tappa/.test(text)) {
    return "last_position";
  }
  if (/(?:parto|partenza|inizio)(?:\s+da)?\s+[A-Za-zÀ-ù]/.test(text)) {
    return "city";
  }
  return null;
}

function extractZoneMode(text: string): JoyTourZoneMode | null {
  if (
    /\bgps\b|qui\s+intorno|intorno\s+a\s+me|nella\s+mia\s+zona|raggio|vicino\s+a\s+me|posizione\s+attuale/.test(
      text
    )
  ) {
    return "gps";
  }
  if (/provincia|prov\b/.test(text)) {
    return "province";
  }
  return null;
}

function extractRadiusKm(text: string): number | null {
  const match = text.match(/(?:raggio|entro)\s*(\d+)\s*km/i);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return Math.min(80, Math.floor(value));
}

/** Rileva comandi di pianificazione giro intelligente. */
export function isJoyTourPlanCommand(message: string): boolean {
  const text = normalize(message);
  if (!text) {
    return false;
  }

  const hasTourVerb =
    /organizza|pianifica|prepara|costruisci|proponi|crea/.test(text) &&
    /giro|tour|percorso|itinerario/.test(text);

  const hasRichConstraints =
    /giro|tour|visite/.test(text) &&
    (/\b\d{5}\b/.test(text) ||
      /max|massimo|entro|fino alle|parto|partenza|fino a|falegnam|showroom|fabbr|prospect|client|provincia|raggio|gps/.test(
        text
      ));

  const prospectTimeFill =
    /\bprospect\b/.test(text) &&
    (/\b(?:[1-9]|10|11|12|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/.test(
      text
    ) ||
      /trovami|trova|dammi|elenca|lista|mostrami|proponi/.test(text)) &&
    /fino\s+alle|entro\s+le|impegnat|impegnino|impegnami|impegnano|tengano|riempi|tempo\s+liber|ore\s+liber/.test(
      text
    );

  // «Trovami N prospect a Latina» senza orario → comunque piano giro (non open company).
  const prospectFindCommand =
    /\bprospect\b/.test(text) &&
    /trovami|trova|dammi|elenca|lista|mostrami|proponi/.test(text) &&
    (/\b(?:[1-9]|10|11|12|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/.test(
      text
    ) ||
      /\ba\b|\bin\b|\bdi\b|\bcap\b|\bzona\b/.test(text));

  // «Parto da via Roma 2, Latina e ho due ore libere» → piano zona, non solo radar generico.
  const startAddressFreeTime =
    /(?:parto|partenza|inizio)(?:\s+da)?/.test(text) &&
    /tempo\s+liber|ore\s+liber|slot\s+liber|impegnat|impegnino|impegnami/.test(text);

  const modificaGiro = /modifica\s+(?:il\s+)?giro/.test(text);
  const rigeneraGiro = /rigenera(?:\s+il)?\s+giro|rigenera\s+(?:la\s+)?proposta/.test(text);

  return (
    hasTourVerb ||
    modificaGiro ||
    rigeneraGiro ||
    prospectTimeFill ||
    prospectFindCommand ||
    startAddressFreeTime ||
    (hasRichConstraints && /organizza|pianifica|prepara|proponi/.test(text))
  );
}

export function isJoyTourIntakeActive(memory?: JoyConversationMemory | null): boolean {
  return memory?.tourDraft?.phase === "intake" && Boolean(memory.tourDraft.awaitingField);
}

export function hasActiveJoyTourDraft(memory?: JoyConversationMemory | null): boolean {
  const phase = memory?.tourDraft?.phase;
  return phase === "proposed" || phase === "active" || phase === "intake";
}

export function parseJoyTourRuntimeCommand(
  message: string
): JoyTourRuntimeCommand | null {
  const text = normalize(message);
  if (!text) {
    return null;
  }

  if (/rigenera(?:\s+il)?\s+giro|rigenera\s+(?:la\s+)?proposta|^rigenera$/.test(text)) {
    return { type: "regenerate" };
  }

  if (/annulla\s+(?:il\s+)?giro|cancella\s+(?:il\s+)?giro|lascia\s+perdere\s+(?:il\s+)?giro/.test(text)) {
    return { type: "cancel_tour" };
  }

  if (/modifica\s+(?:il\s+)?giro/.test(text)) {
    return { type: "modify", raw: message.trim() };
  }

  const replaceMatch = message.match(
    /(?:sostituisci|rimpiazza|cambia)\s+(?:il\s+)?(?:cliente|prospect|tappa|visita)?\s*(.+?)\s+con\s+(?:il\s+)?(?:cliente|prospect)?\s*(.+)$/i
  );
  if (replaceMatch) {
    const removeQuery = replaceMatch[1]?.trim().replace(/[?.!,]+$/, "") || null;
    const addQuery = replaceMatch[2]?.trim().replace(/[?.!,]+$/, "") || null;
    if (addQuery) {
      return { type: "replace", removeQuery, addQuery };
    }
  }

  if (
    /salta(?:\s+(?:il\s+)?(?:cliente|prospect|tappa|visita))?|skip(?:\s+client)?|escludi|rimuovi(?:\s+(?:il\s+)?(?:cliente|prospect|tappa|visita))?|elimina(?:\s+(?:il\s+)?(?:cliente|tappa))?/.test(
      text
    )
  ) {
    const nameMatch = message.match(
      /(?:salta|skip|escludi|rimuovi|elimina)(?:\s+(?:il|la|lo))?\s+(?:cliente|prospect|tappa|visita)?\s*(.+)?/i
    );
    const query = nameMatch?.[1]?.trim().replace(/[?.!,]+$/, "") || null;
    if (query && /^(cliente|prospect|tappa|visita|questo|questa|il|la)$/i.test(query)) {
      return { type: "skip", companyQuery: null };
    }
    return { type: "skip", companyQuery: query };
  }

  if (
    /aggiungi(?:\s+(?:una?\s+)?(?:visita|tappa|cliente|prospect))?|inserisci(?:\s+(?:una?\s+)?(?:visita|tappa))?/.test(
      text
    )
  ) {
    const nameMatch = message.match(
      /(?:aggiungi|inserisci)(?:\s+(?:una?|il|la))?\s+(?:visita|tappa|cliente|prospect)?\s*(.+)?/i
    );
    const query = nameMatch?.[1]?.trim().replace(/[?.!,]+$/, "") || null;
    if (query && /^(visita|tappa|cliente|prospect|uno|una)$/i.test(query)) {
      return { type: "add", companyQuery: null };
    }
    return { type: "add", companyQuery: query };
  }

  if (
    /prospect\s+vicin|vicino\s+(?:un\s+)?prospect|cerca\s+(?:un\s+)?prospect|trova\s+(?:un\s+)?prospect/.test(
      text
    )
  ) {
    return { type: "nearby_prospect" };
  }

  if (
    /(?:trova|cerca|aggiungi).*(?:falegnam|showroom|fabbr)|(?:falegnam|showroom|fabbr).*(?:vicin|qui|zona)/.test(
      text
    )
  ) {
    const segment = extractSegment(text);
    if (segment === "falegnami" || segment === "showroom" || segment === "fabbri") {
      return { type: "nearby_segment", segment };
    }
  }

  if (
    /evita(?:re)?\s+(?:il\s+)?traffico|traffico|percorso\s+(?:piu|più)\s+veloce|riduci\s+(?:i\s+)?tempi|ottimizza\s+(?:i\s+)?tempi/.test(
      text
    )
  ) {
    return { type: "avoid_traffic" };
  }

  if (
    /arriva(?:re)?\s+(?:entro|entro\s+le|alle)|entro\s+le\s+\d|fino\s+alle\s+\d/.test(text)
  ) {
    const time = extractMaxArrivalTime(message);
    if (time) {
      return { type: "arrive_by", time };
    }
  }

  if (/prossima\s+tappa|prossimo\s+stop|next\s+stop|dove\s+(?:vado|devo\s+andare)\s+adesso/.test(text)) {
    return { type: "next_stop" };
  }

  if (/chiama(?:\s+(?:il\s+)?)?(?:referente|contatto)|telefono(?:\s+al)?\s+referente|chiama(?:\s+il)?\s+cliente/.test(text)) {
    const nameMatch = message.match(
      /(?:chiama|telefono)(?:\s+(?:il|la|lo))?\s+(?:referente|contatto|cliente)?\s*(.+)?/i
    );
    const query = nameMatch?.[1]?.trim().replace(/[?.!,]+$/, "") || null;
    if (query && /^(referente|contatto|cliente)$/i.test(query)) {
      return { type: "call_referent", companyQuery: null };
    }
    return { type: "call_referent", companyQuery: query };
  }

  if (
    /apri\s+google\s+maps|apri\s+maps|naviga(?:\s+su\s+maps)?|apri\s+navigatore|indicazioni\s+stradali/.test(
      text
    )
  ) {
    return { type: "open_maps" };
  }

  return null;
}

export function parseJoyTourPlanRequest(
  message: string,
  memory?: {
    lastComune?: string | null;
    lastCap?: string | null;
    lastDestinazione?: string | null;
    tourDraft?: JoyTourPlanDraft | null;
  }
): JoyTourPlanRequest | null {
  if (!isJoyTourPlanCommand(message) && memory?.tourDraft?.phase !== "intake") {
    return null;
  }

  const text = normalize(message);
  const draft = memory?.tourDraft;
  const dayFromMsg = extractDay(text);
  const { start, end } = extractStartEnd(message);
  const segment = extractSegment(text);
  const audienceFromMsg = extractAudience(text);
  const capFromMsg = extractCap(message);
  const provinceFromMsg = extractProvince(message);
  const coordsFromMsg = extractCoordinates(message);
  const maxStopsFromMsg = extractMaxStops(message);
  const maxArrivalFromMsg = extractMaxArrivalTime(message);
  const startModeFromMsg = extractStartMode(text);
  const zoneModeFromMsg = extractZoneMode(text);
  const radiusFromMsg = extractRadiusKm(text);
  const cityFromMsg = extractCity(message, start, end);
  const cityFromStartAddress = extractCityFromAddress(start);

  const cap = capFromMsg ?? draft?.cap ?? memory?.lastCap ?? null;
  const province = provinceFromMsg ?? draft?.province ?? null;
  const startCity = start ?? draft?.startCity ?? null;
  const endCity = end ?? draft?.endCity ?? memory?.lastDestinazione ?? null;
  // Mai usare un indirizzo stradale come città target (es. «via Roma» → Roma).
  const startAsCity =
    startCity && !isStreetLike(startCity) ? startCity : null;
  const city =
    cityFromMsg ??
    cityFromStartAddress ??
    draft?.city ??
    startAsCity ??
    memory?.lastComune ??
    null;

  const centerLat = coordsFromMsg?.lat ?? draft?.lastLat ?? null;
  const centerLng = coordsFromMsg?.lng ?? draft?.lastLng ?? null;

  const zoneMode: JoyTourZoneMode | null =
    zoneModeFromMsg ??
    (coordsFromMsg ? "gps" : null) ??
    draft?.zoneMode ??
    (cap ? "cap" : province ? "province" : city ? "city" : null);

  const startAddressFreeTime =
    Boolean(start) &&
    /tempo\s+liber|ore\s+liber|slot\s+liber/.test(text) &&
    Boolean(city);

  // «Trovami N prospect a X fino alle HH»: defaults operativi (oggi + sede), no intake.
  const prospectTimeFill =
    /\bprospect\b/.test(text) &&
    Boolean(cityFromMsg || cityFromStartAddress || capFromMsg) &&
    maxStopsFromMsg != null &&
    Boolean(maxArrivalFromMsg);

  // «Trovami N prospect a X» senza orario: stessi default, orario fine giornata soft.
  const prospectFindOnly =
    /\bprospect\b/.test(text) &&
    /trovami|trova|dammi|elenca|lista|mostrami|proponi/.test(text) &&
    Boolean(cityFromMsg || cityFromStartAddress || capFromMsg) &&
    maxStopsFromMsg != null &&
    !maxArrivalFromMsg;

  const operationalDefaults = prospectTimeFill || prospectFindOnly;

  const audience =
    audienceFromMsg ??
    (startAddressFreeTime ? "prospect" : null) ??
    draft?.audience ??
    (segment === "prospect"
      ? "prospect"
      : segment === "clienti"
        ? "clienti"
        : null);

  const maxStops =
    maxStopsFromMsg ?? (startAddressFreeTime ? 5 : null) ?? draft?.maxStops ?? null;
  const maxArrivalTime =
    maxArrivalFromMsg ??
    (startAddressFreeTime || prospectFindOnly ? "17:00" : null) ??
    draft?.maxArrivalTime ??
    null;
  const radiusKm = radiusFromMsg ?? draft?.radiusKm ?? 30;

  const provided: JoyTourPlanRequest["provided"] = {};
  if (dayFromMsg) provided.day = true;
  if (
    capFromMsg ||
    cityFromMsg ||
    cityFromStartAddress ||
    provinceFromMsg ||
    coordsFromMsg ||
    start ||
    zoneModeFromMsg === "gps"
  ) {
    provided.zone = true;
  }
  if (
    audienceFromMsg ||
    segment === "prospect" ||
    segment === "clienti" ||
    startAddressFreeTime ||
    operationalDefaults
  ) {
    provided.audience = true;
  }
  if (maxStopsFromMsg != null || startAddressFreeTime || operationalDefaults) {
    provided.maxStops = true;
  }
  if (maxArrivalFromMsg || startAddressFreeTime || prospectFindOnly) {
    provided.maxArrivalTime = true;
  }
  if (startModeFromMsg || start || operationalDefaults) provided.startMode = true;
  if (segment === "falegnami" || segment === "showroom" || segment === "fabbri") provided.segment = true;

  const hasZone = Boolean(
    cap ||
      city ||
      province ||
      coordsFromMsg ||
      draft?.cap ||
      draft?.city ||
      draft?.province ||
      zoneMode === "gps" ||
      draft?.zoneMode === "gps"
  );

  const resolvedDay =
    dayFromMsg ??
    (operationalDefaults || startAddressFreeTime ? "today" : null) ??
    draft?.day ??
    null;
  const resolvedStartMode =
    startModeFromMsg ??
    (start ? "city" : null) ??
    (operationalDefaults ? "sede" : null) ??
    draft?.startMode ??
    null;

  const resolvedSegment: JoyTourSegmentFilter =
    segment ??
    (startAddressFreeTime || audience === "prospect" || operationalDefaults
      ? "prospect"
      : null);

  return {
    day: resolvedDay ?? "tomorrow",
    city: zoneMode === "gps" || zoneMode === "province" ? null : city,
    cap: zoneMode === "gps" || zoneMode === "province" ? null : cap,
    province: zoneMode === "province" ? province : zoneMode === "gps" ? null : province,
    zoneMode,
    radiusKm,
    centerLat: zoneMode === "gps" ? centerLat : null,
    centerLng: zoneMode === "gps" ? centerLng : null,
    segment: resolvedSegment,
    commercialStatus: extractCommercialStatus(text, resolvedSegment, audience),
    audience: audience ?? (operationalDefaults ? "prospect" : "entrambi"),
    maxStops: maxStops ?? JOY_TOUR_MID_MAX_STOPS,
    maxArrivalTime,
    startMode: resolvedStartMode ?? (zoneMode === "gps" ? "gps" : "sede"),
    startCity,
    endCity,
    forceIncludeCompanyIds: draft?.forceIncludeCompanyIds ?? [],
    rawText: message.trim(),
    provided: {
      ...provided,
      day: Boolean(dayFromMsg || draft?.day || operationalDefaults || startAddressFreeTime),
      zone: Boolean(hasZone || provided.zone),
      audience: Boolean(
        audienceFromMsg ||
          draft?.audience ||
          segment === "prospect" ||
          segment === "clienti" ||
          startAddressFreeTime ||
          operationalDefaults
      ),
      maxStops: Boolean(
        maxStopsFromMsg != null ||
          draft?.maxStops != null ||
          startAddressFreeTime ||
          operationalDefaults
      ),
      maxArrivalTime: Boolean(
        maxArrivalFromMsg ||
          draft?.maxArrivalTime ||
          startAddressFreeTime ||
          prospectFindOnly
      ),
      startMode: Boolean(
        startModeFromMsg ||
          start ||
          draft?.startMode ||
          zoneMode === "gps" ||
          operationalDefaults
      ),
    },
  };
}

/** Campi ancora da chiedere in intake, in ordine. */
export function getMissingTourFields(request: JoyTourPlanRequest): JoyTourIntakeField[] {
  const missing: JoyTourIntakeField[] = [];
  if (!request.provided.day) missing.push("day");
  if (!request.provided.zone) missing.push("zone");
  if (!request.provided.audience) missing.push("audience");
  if (!request.provided.maxStops) missing.push("maxStops");
  if (!request.provided.maxArrivalTime) missing.push("maxArrivalTime");
  if (!request.provided.startMode) missing.push("startMode");
  return missing;
}

export function isTourRequestComplete(request: JoyTourPlanRequest): boolean {
  return getMissingTourFields(request).length === 0;
}

/** Applica una risposta a una singola domanda di intake. */
export function applyTourIntakeAnswer(
  draft: JoyTourPlanDraft,
  message: string
): JoyTourPlanDraft {
  const text = normalize(message);
  const field = draft.awaitingField;
  const next: JoyTourPlanDraft = { ...draft, phase: "intake" };

  if (!field) {
    return mergePartialTourAnswer(next, message);
  }

  switch (field) {
    case "day": {
      const day = extractDay(text);
      if (day) {
        next.day = day;
        next.awaitingField = null;
      } else if (/oggi|domani/.test(text) === false && /^(1|2)$/.test(text.trim())) {
        next.day = text.trim() === "1" ? "today" : "tomorrow";
        next.awaitingField = null;
      }
      break;
    }
    case "zone": {
      const zoneMode = extractZoneMode(text);
      const radiusKm = extractRadiusKm(text);
      const cap = extractCap(message);
      const province = extractProvince(message);
      const coords = extractCoordinates(message);
      const parsedCity = extractCity(message, null, null);
      const rawCity = message.trim().replace(/[?.!,]+$/, "");
      const city = parsedCity ?? (rawCity.length > 1 ? rawCity : null);
      if (coords) {
        next.zoneMode = "gps";
        next.cap = null;
        next.city = null;
        next.province = null;
        next.lastLat = coords.lat;
        next.lastLng = coords.lng;
        if (!next.startMode) {
          next.startMode = "gps";
        }
        next.awaitingField = null;
      } else if (zoneMode === "gps" || /^1$/.test(text.trim())) {
        next.zoneMode = "gps";
        next.cap = null;
        next.city = null;
        next.province = null;
        if (!next.startMode) {
          next.startMode = "gps";
        }
        next.awaitingField = null;
      } else if (cap) {
        next.cap = cap;
        next.province = null;
        next.zoneMode = "cap";
        next.awaitingField = null;
      } else if (province || zoneMode === "province") {
        if (province) {
          next.province = province;
          next.cap = null;
          next.city = null;
          next.zoneMode = "province";
          next.awaitingField = null;
        }
      } else if (city && !/^(non|no|skip|passa|gps|provincia)$/i.test(city)) {
        next.city = city;
        next.province = null;
        next.zoneMode = "city";
        next.awaitingField = null;
      }
      if (radiusKm != null) {
        next.radiusKm = radiusKm;
      }
      break;
    }
    case "audience": {
      const audience = extractAudience(text);
      if (audience) {
        next.audience = audience;
        next.awaitingField = null;
      } else if (/^1$|prospect/.test(text)) {
        next.audience = "prospect";
        next.awaitingField = null;
      } else if (/^2$|client/.test(text)) {
        next.audience = "clienti";
        next.awaitingField = null;
      } else if (/^3$|entrambi|tutti/.test(text)) {
        next.audience = "entrambi";
        next.awaitingField = null;
      }
      break;
    }
    case "maxStops": {
      const stops = extractMaxStops(message);
      if (stops != null) {
        next.maxStops = stops;
        next.awaitingField = null;
      }
      break;
    }
    case "maxArrivalTime": {
      const time = extractMaxArrivalTime(message);
      if (time) {
        next.maxArrivalTime = time;
        next.awaitingField = null;
      } else if (/nessun\s+limite|senza\s+orario|quando\s+finisco/.test(text)) {
        next.maxArrivalTime = "18:00";
        next.awaitingField = null;
      }
      break;
    }
    case "startMode": {
      const mode = extractStartMode(text);
      if (mode) {
        next.startMode = mode;
        next.awaitingField = null;
      } else if (/^1$|gps|posizione/.test(text)) {
        next.startMode = "gps";
        next.awaitingField = null;
      } else if (/^2$|sede|ufficio|eterya/.test(text)) {
        next.startMode = "sede";
        next.awaitingField = null;
      } else if (/^3$|ultima/.test(text)) {
        next.startMode = "last_position";
        next.awaitingField = null;
      } else {
        const cityOnly = message.trim().replace(/[?.!,]+$/, "");
        if (cityOnly.length > 2) {
          next.startMode = "city";
          next.startCity = cityOnly;
          next.awaitingField = null;
        }
      }
      break;
    }
  }

  return next;
}

function mergePartialTourAnswer(draft: JoyTourPlanDraft, message: string): JoyTourPlanDraft {
  const text = normalize(message);
  const next = { ...draft };
  const day = extractDay(text);
  if (day) next.day = day;
  const cap = extractCap(message);
  if (cap) {
    next.cap = cap;
    next.zoneMode = "cap";
  }
  const province = extractProvince(message);
  if (province) {
    next.province = province;
    next.zoneMode = "province";
    next.cap = null;
    next.city = null;
  }
  const coords = extractCoordinates(message);
  if (coords) {
    next.zoneMode = "gps";
    next.lastLat = coords.lat;
    next.lastLng = coords.lng;
    next.cap = null;
    next.city = null;
    next.province = null;
    if (!next.startMode) next.startMode = "gps";
  }
  const radiusKm = extractRadiusKm(text);
  if (radiusKm != null) next.radiusKm = radiusKm;
  const zoneMode = extractZoneMode(text);
  if (zoneMode) {
    next.zoneMode = zoneMode;
    if (zoneMode === "gps") {
      next.cap = null;
      next.city = null;
      next.province = null;
      if (!next.startMode) next.startMode = "gps";
    }
  }
  const audience = extractAudience(text);
  if (audience) next.audience = audience;
  const stops = extractMaxStops(message);
  if (stops != null) next.maxStops = stops;
  const time = extractMaxArrivalTime(message);
  if (time) next.maxArrivalTime = time;
  const mode = extractStartMode(text);
  if (mode) next.startMode = mode;
  const { start, end } = extractStartEnd(message);
  if (start) next.startCity = start;
  if (end) next.endCity = end;
  const city = extractCity(message, start, end);
  if (city && !province) {
    next.city = city;
    if (!next.zoneMode) next.zoneMode = "city";
  }
  return next;
}

export function draftToPartialRequest(
  draft: JoyTourPlanDraft,
  rawText: string
): JoyTourPlanRequest {
  const audience = draft.audience ?? "entrambi";
  const zoneMode =
    draft.zoneMode ??
    (draft.cap ? "cap" : draft.province ? "province" : draft.city ? "city" : null);
  return {
    day: draft.day ?? "tomorrow",
    city: draft.city ?? null,
    cap: draft.cap ?? null,
    province: draft.province ?? null,
    zoneMode,
    radiusKm: draft.radiusKm ?? 30,
    centerLat: draft.lastLat ?? null,
    centerLng: draft.lastLng ?? null,
    segment:
      audience === "prospect" ? "prospect" : audience === "clienti" ? "clienti" : null,
    commercialStatus:
      audience === "prospect" ? "prospect" : audience === "clienti" ? "cliente" : null,
    audience,
    maxStops: draft.maxStops ?? JOY_TOUR_MID_MAX_STOPS,
    maxArrivalTime: draft.maxArrivalTime ?? null,
    startMode: draft.startMode ?? (zoneMode === "gps" ? "gps" : "sede"),
    startCity: draft.startCity ?? null,
    endCity: draft.endCity ?? null,
    forceIncludeCompanyIds: draft.forceIncludeCompanyIds ?? [],
    rawText,
    provided: {
      day: Boolean(draft.day),
      zone: Boolean(
        draft.cap || draft.city || draft.province || zoneMode === "gps" || draft.lastLat != null
      ),
      audience: Boolean(draft.audience),
      maxStops: draft.maxStops != null,
      maxArrivalTime: Boolean(draft.maxArrivalTime),
      startMode: Boolean(draft.startMode || zoneMode === "gps"),
    },
  };
}

/** Cap effettivo mid-tour: non supera 6 salvo intake esplicito >6. */
export function resolveMidTourMaxStops(
  draftMaxStops: number | null | undefined,
  needed: number
): { ok: true; maxStops: number } | { ok: false; cap: number } {
  const userMax = draftMaxStops ?? JOY_TOUR_MID_MAX_STOPS;
  const hardCap = userMax > JOY_TOUR_MID_MAX_STOPS ? userMax : JOY_TOUR_MID_MAX_STOPS;
  if (needed > hardCap) {
    return { ok: false, cap: hardCap };
  }
  return { ok: true, maxStops: Math.min(hardCap, Math.max(userMax, needed)) };
}

export function buildIntakeQuestion(
  field: JoyTourIntakeField,
  options?: { hasGps?: boolean; hasLastPosition?: boolean; hasSede?: boolean }
): string {
  switch (field) {
    case "day":
      return "Per quale **giorno** organizzo il giro?\n1. Oggi\n2. Domani";
    case "zone":
      return "In quale **zona**?\n1. **GPS** (raggio intorno a me)\nOppure **CAP**, **comune**, **provincia** (es. LT) o coordinate.";
    case "audience":
      return "Che tipo di visite preferisci?\n1. **Prospect**\n2. **Clienti**\n3. **Entrambi**";
    case "maxStops":
      return "Quante visite vuoi fare?\n**4** · **6** · **8** oppure un numero a scelta (max 12).";
    case "maxArrivalTime":
      return "Entro che ora vuoi **finire**? Es. «entro le 17» oppure «18:00».";
    case "startMode": {
      const lines = ["Da dove **parti**?"];
      if (options?.hasGps !== false) {
        lines.push("1. **GPS** (posizione attuale)");
      }
      if (options?.hasSede !== false) {
        lines.push("2. **Sede Eterya**");
      }
      if (options?.hasLastPosition) {
        lines.push("3. **Ultima posizione** nota");
      }
      lines.push("Oppure dimmi una **città** di partenza.");
      return lines.join("\n");
    }
  }
}
