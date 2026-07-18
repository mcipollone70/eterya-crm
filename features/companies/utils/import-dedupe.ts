/**
 * Normalizzazione e matching per deduplicazione import aziende.
 * Funzioni pure — usabili da servizio e da test.
 */

export function normalizeVat(value: string | null | undefined): string {
  return (value ?? "").replace(/\s/g, "").toUpperCase();
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeNameKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAddressKey(value: string | null | undefined): string {
  return normalizeNameKey(value);
}

export function buildNameCityKey(name: string, city: string): string {
  return `${normalizeNameKey(name)}|${normalizeNameKey(city)}`;
}

export function buildNameAddressKey(name: string, address: string): string {
  return `${normalizeNameKey(name)}|${normalizeAddressKey(address)}`;
}

export type DedupeMatchReason = "vat" | "email" | "name_city" | "name_address";

export interface DedupeCandidate {
  id: string;
  vat_number: string | null;
  email: string | null;
  name: string;
  city: string | null;
  address: string | null;
}

export interface DedupeLookup {
  byVat: Map<string, DedupeCandidate>;
  byEmail: Map<string, DedupeCandidate>;
  byNameCity: Map<string, DedupeCandidate>;
  byNameAddress: Map<string, DedupeCandidate>;
}

export function buildDedupeLookup(rows: DedupeCandidate[]): DedupeLookup {
  const byVat = new Map<string, DedupeCandidate>();
  const byEmail = new Map<string, DedupeCandidate>();
  const byNameCity = new Map<string, DedupeCandidate>();
  const byNameAddress = new Map<string, DedupeCandidate>();

  for (const row of rows) {
    const vat = normalizeVat(row.vat_number);
    if (vat && !byVat.has(vat)) byVat.set(vat, row);

    const email = normalizeEmail(row.email);
    if (email && !byEmail.has(email)) byEmail.set(email, row);

    if (row.name && row.city) {
      const key = buildNameCityKey(row.name, row.city);
      if (key !== "|" && !byNameCity.has(key)) byNameCity.set(key, row);
    }

    if (row.name && row.address) {
      const key = buildNameAddressKey(row.name, row.address);
      if (key !== "|" && !byNameAddress.has(key)) byNameAddress.set(key, row);
    }
  }

  return { byVat, byEmail, byNameCity, byNameAddress };
}

export function findExistingCompany(
  lookup: DedupeLookup,
  input: {
    vatNumber?: string | null;
    email?: string | null;
    name?: string | null;
    city?: string | null;
    address?: string | null;
  }
): { company: DedupeCandidate; reason: DedupeMatchReason } | null {
  const vat = normalizeVat(input.vatNumber);
  if (vat) {
    const hit = lookup.byVat.get(vat);
    if (hit) return { company: hit, reason: "vat" };
  }

  const email = normalizeEmail(input.email);
  if (email) {
    const hit = lookup.byEmail.get(email);
    if (hit) return { company: hit, reason: "email" };
  }

  if (input.name && input.city) {
    const key = buildNameCityKey(input.name, input.city);
    const hit = lookup.byNameCity.get(key);
    if (hit) return { company: hit, reason: "name_city" };
  }

  if (input.name && input.address) {
    const key = buildNameAddressKey(input.name, input.address);
    const hit = lookup.byNameAddress.get(key);
    if (hit) return { company: hit, reason: "name_address" };
  }

  return null;
}

/** Conta duplicati nel file (stesso vat/email/name+city). */
export function countInFileDuplicates(
  rows: Array<{
    vatNumber?: string;
    email?: string;
    name?: string;
    city?: string;
  }>
): number {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const keys: string[] = [];
    const vat = normalizeVat(row.vatNumber);
    if (vat) keys.push(`vat:${vat}`);
    const email = normalizeEmail(row.email);
    if (email) keys.push(`email:${email}`);
    if (row.name && row.city) {
      keys.push(`nc:${buildNameCityKey(row.name, row.city)}`);
    }

    if (keys.length === 0) continue;

    const already = keys.some((k) => seen.has(k));
    for (const k of keys) seen.add(k);
    if (already) duplicates += 1;
  }

  return duplicates;
}

/** Merge: mantiene valori esistenti se overwrite=false; altrimenti usa incoming se non vuoto. */
export function mergeCompanyFields<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
  overwriteExistingFields: boolean
): Partial<T> {
  const patch: Partial<T> = {};

  for (const [key, incomingValue] of Object.entries(incoming) as Array<
    [keyof T, T[keyof T]]
  >) {
    if (incomingValue === undefined) continue;

    const current = existing[key];
    const currentEmpty =
      current === null ||
      current === undefined ||
      (typeof current === "string" && current.trim() === "");

    const incomingEmpty =
      incomingValue === null ||
      incomingValue === undefined ||
      (typeof incomingValue === "string" && String(incomingValue).trim() === "");

    if (incomingEmpty) continue;

    if (overwriteExistingFields || currentEmpty) {
      patch[key] = incomingValue;
    }
  }

  return patch;
}

/**
 * Decisione is_primary per company_brands.
 * - se il link esiste già ed è primary → resta primary
 * - se setPrimaryIfNone e non esiste alcun primary → diventa primary
 * - altrimenti non sovrascrive un primary esistente di altro Brand
 */
export function resolveBrandIsPrimary(input: {
  existingLinkIsPrimary: boolean;
  companyHasAnyPrimary: boolean;
  setPrimaryIfNone: boolean;
}): boolean {
  if (input.existingLinkIsPrimary) return true;
  if (input.setPrimaryIfNone && !input.companyHasAnyPrimary) return true;
  return false;
}

/** Aggiorna customer_code sul link Brand (sempre se presente nel file). */
export function resolveCustomerCodeUpdate(
  incoming: string | null | undefined,
  existing: string | null | undefined
): string | null {
  const next = (incoming ?? "").trim();
  if (next) return next;
  const prev = (existing ?? "").trim();
  return prev || null;
}
