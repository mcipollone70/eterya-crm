import type { CleaningReport } from "../types/import";

const ITALIAN_PROVINCE_MAP: Record<string, string> = {
  agrigento: "AG",
  alessandria: "AL",
  ancona: "AN",
  aosta: "AO",
  "valle d aosta": "AO",
  arezzo: "AR",
  "ascoli piceno": "AP",
  asti: "AT",
  avellino: "AV",
  bari: "BA",
  "barletta andria trani": "BT",
  belluno: "BL",
  benevento: "BN",
  bergamo: "BG",
  biella: "BI",
  bologna: "BO",
  bolzano: "BZ",
  brescia: "BS",
  brindisi: "BR",
  cagliari: "CA",
  caltanissetta: "CL",
  campobasso: "CB",
  caserta: "CE",
  catania: "CT",
  catanzaro: "CZ",
  chieti: "CH",
  como: "CO",
  cosenza: "CS",
  cremona: "CR",
  crotone: "KR",
  cuneo: "CN",
  enna: "EN",
  fermo: "FM",
  ferrara: "FE",
  firenze: "FI",
  foggia: "FG",
  "forli cesena": "FC",
  frosinone: "FR",
  genova: "GE",
  gorizia: "GO",
  grosseto: "GR",
  imperia: "IM",
  isernia: "IS",
  "l aquila": "AQ",
  "la spezia": "SP",
  latina: "LT",
  lecce: "LE",
  lecco: "LC",
  livorno: "LI",
  lodi: "LO",
  lucca: "LU",
  macerata: "MC",
  mantova: "MN",
  "massa carrara": "MS",
  matera: "MT",
  messina: "ME",
  milano: "MI",
  modena: "MO",
  monza: "MB",
  "monza e brianza": "MB",
  napoli: "NA",
  novara: "NO",
  nuoro: "NU",
  oristano: "OR",
  padova: "PD",
  palermo: "PA",
  parma: "PR",
  pavia: "PV",
  perugia: "PG",
  "pesaro e urbino": "PU",
  pescara: "PE",
  piacenza: "PC",
  pisa: "PI",
  pistoia: "PT",
  pordenone: "PN",
  potenza: "PZ",
  prato: "PO",
  ragusa: "RG",
  ravenna: "RA",
  "reggio calabria": "RC",
  "reggio emilia": "RE",
  rieti: "RI",
  rimini: "RN",
  roma: "RM",
  rovigo: "RO",
  salerno: "SA",
  sassari: "SS",
  savona: "SV",
  siena: "SI",
  siracusa: "SR",
  sondrio: "SO",
  "taranto": "TA",
  teramo: "TE",
  terni: "TR",
  torino: "TO",
  trapani: "TP",
  trento: "TN",
  treviso: "TV",
  trieste: "TS",
  udine: "UD",
  varese: "VA",
  venezia: "VE",
  "verbano cusio ossola": "VB",
  vercelli: "VC",
  verona: "VR",
  "vibo valentia": "VV",
  vicenza: "VI",
  viterbo: "VT",
};

export function removeDoubleSpaces(value: string): string {
  return value.replace(/\s{2,}/g, " ").trim();
}

export function removeStrangeCharacters(value: string): string {
  return value
    .replace(/[^\w\s@.,/'\-àèéìòùÀÈÉÌÒÙ]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalizePostalCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(0, 5).padStart(5, "0");
}

export function normalizeProvince(value: string): string {
  const cleaned = removeStrangeCharacters(value).toUpperCase();
  if (!cleaned) return "";

  if (/^[A-Z]{2}$/.test(cleaned)) {
    return cleaned;
  }

  const normalized = cleaned
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ITALIAN_PROVINCE_MAP[normalized] ?? cleaned.slice(0, 2);
}

export function normalizeCity(value: string): string {
  const cleaned = removeStrangeCharacters(value);
  if (!cleaned) return "";

  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function mergeStreetAndNumber(street: string, streetNumber: string): string {
  const via = removeDoubleSpaces(street);
  const civico = removeDoubleSpaces(streetNumber);

  if (!via && !civico) return "";
  if (!via) return civico;
  if (!civico) return via;
  return `${via} ${civico}`;
}

export function cleanTextField(value: string): { value: string; trimmed: boolean; sanitized: boolean } {
  const trimmed = removeDoubleSpaces(value);
  const sanitized = removeStrangeCharacters(trimmed);
  return {
    value: sanitized,
    trimmed: trimmed !== value,
    sanitized: sanitized !== trimmed,
  };
}

export function createEmptyCleaningReport(): CleaningReport {
  return {
    mergedStreetNumbers: 0,
    normalizedPostalCodes: 0,
    normalizedProvinces: 0,
    normalizedCities: 0,
    trimmedSpaces: 0,
    removedSpecialChars: 0,
  };
}

export function mergeCleaningReports(a: CleaningReport, b: CleaningReport): CleaningReport {
  return {
    mergedStreetNumbers: a.mergedStreetNumbers + b.mergedStreetNumbers,
    normalizedPostalCodes: a.normalizedPostalCodes + b.normalizedPostalCodes,
    normalizedProvinces: a.normalizedProvinces + b.normalizedProvinces,
    normalizedCities: a.normalizedCities + b.normalizedCities,
    trimmedSpaces: a.trimmedSpaces + b.trimmedSpaces,
    removedSpecialChars: a.removedSpecialChars + b.removedSpecialChars,
  };
}
