import {
  buildFullAddress,
  dedupeRepeatedWords,
  type CompanyAddressParts,
} from "./build-full-address";

export type { CompanyAddressParts };

function trimValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return null;
  }

  return normalized;
}

/** Rimuove spazi doppi, caratteri di controllo e punteggiatura ridondante. */
export function cleanAddressText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[;|]+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

const STREET_ABBREVIATION_RULES: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bv\.?\s*le\.?\b/gi, replacement: "Viale" },
  { pattern: /\bp\.?\s*zza\.?\b/gi, replacement: "Piazza" },
  { pattern: /\bp\.?\s*za\.?\b/gi, replacement: "Piazza" },
  { pattern: /\bc\.?\s*so\.?\b/gi, replacement: "Corso" },
  { pattern: /\bl\.?\s*go\.?\b/gi, replacement: "Largo" },
  { pattern: /\bp\.?\s*lle\.?\b/gi, replacement: "Piazzale" },
  { pattern: /\bvic\.?\b/gi, replacement: "Vicolo" },
  { pattern: /\bstr\.?\b/gi, replacement: "Strada" },
  { pattern: /\bv\.?\s+(?!le\b)/gi, replacement: "Via " },
  { pattern: /\bvia\b/gi, replacement: "Via" },
];

/** Espande abbreviazioni stradali italiane comuni (VIA, V.LE, P.ZZA, C.SO …). */
export function normalizeStreetAbbreviations(text: string): string {
  let result = text;

  for (const rule of STREET_ABBREVIATION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }

  return dedupeRepeatedWords(cleanAddressText(result));
}

function normalizeParts(
  parts: CompanyAddressParts,
  expandAbbreviations = false
): CompanyAddressParts {
  const normalizeField = (value: string | null | undefined): string | null => {
    const trimmed = trimValue(value);
    if (!trimmed) {
      return null;
    }
    return cleanAddressText(trimmed);
  };

  const transformStreet = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    return expandAbbreviations ? normalizeStreetAbbreviations(value) : value;
  };

  const address = normalizeField(parts.address);
  const street = normalizeField(parts.street);
  const streetNumber = normalizeField(parts.street_number);

  return {
    address: transformStreet(address),
    street: transformStreet(street),
    street_number: streetNumber,
    postal_code: normalizeField(parts.postal_code),
    city: normalizeField(parts.city),
    province: normalizeField(parts.province),
    country: normalizeField(parts.country) ?? "IT",
  };
}

function buildVariantAddress(parts: CompanyAddressParts): string | null {
  const built = buildFullAddress(parts);
  if (!built) {
    return null;
  }

  return cleanAddressText(built);
}

function uniqueVariants(variants: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const variant of variants) {
    const key = variant.toLowerCase();
    if (!variant || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(variant);
  }

  return result;
}

/**
 * Genera varianti di indirizzo in ordine di specificità decrescente.
 * Ogni variante è normalizzata (abbreviazioni, spazi, caratteri inutili).
 */
export function buildGeocodeAddressVariants(parts: CompanyAddressParts): string[] {
  const base = normalizeParts(parts, false);
  const abbreviated = normalizeParts(parts, true);

  const full = buildVariantAddress(base);
  const fullAbbrev = buildVariantAddress(abbreviated);
  const withoutCap = buildVariantAddress({ ...base, postal_code: null });
  const withoutCapAbbrev = buildVariantAddress({ ...abbreviated, postal_code: null });
  const withoutNumber = buildVariantAddress({ ...base, street_number: null });
  const withoutNumberAbbrev = buildVariantAddress({ ...abbreviated, street_number: null });
  const withoutCapAndNumber = buildVariantAddress({
    ...base,
    postal_code: null,
    street_number: null,
  });
  const cityProvince = buildVariantAddress({
    address: null,
    street: null,
    street_number: null,
    postal_code: null,
    city: base.city,
    province: base.province,
    country: base.country,
  });
  const cityProvinceAbbrev = buildVariantAddress({
    address: null,
    street: null,
    street_number: null,
    postal_code: null,
    city: abbreviated.city,
    province: abbreviated.province,
    country: abbreviated.country,
  });

  return uniqueVariants(
    [
      full,
      withoutCap,
      withoutNumber,
      cityProvince,
      fullAbbrev,
      withoutCapAbbrev,
      withoutNumberAbbrev,
      withoutCapAndNumber,
      cityProvinceAbbrev,
    ].filter((variant): variant is string => Boolean(variant))
  );
}
