export interface CompanyAddressParts {
  address?: string | null;
  street?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}

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

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rimuove ripetizioni consecutive come "Via Via Roma". */
export function dedupeRepeatedWords(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const word of words) {
    const norm = normalizeToken(word);
    const prevNorm =
      result.length > 0 ? normalizeToken(result[result.length - 1]!) : null;

    if (prevNorm !== norm) {
      result.push(word);
    }
  }

  return result.join(" ");
}

function appendUniquePart(segments: string[], part: string | null): void {
  if (!part) {
    return;
  }

  const normPart = normalizeToken(part);
  const alreadyPresent = segments.some(
    (segment) => normalizeToken(segment) === normPart
  );

  if (!alreadyPresent) {
    segments.push(part);
  }
}

function buildStreetLine(parts: CompanyAddressParts): string | null {
  const address = trimValue(parts.address);
  const street = trimValue(parts.street);
  const streetNumber = trimValue(parts.street_number);

  if (address) {
    let line = dedupeRepeatedWords(address);

    if (street) {
      const normAddress = normalizeToken(line);
      const normStreet = normalizeToken(street);

      if (normAddress.startsWith(normStreet)) {
        line = dedupeRepeatedWords(address);
      } else if (!normAddress.includes(normStreet)) {
        line = dedupeRepeatedWords(`${street} ${line}`);
      }
    }

    if (streetNumber && !line.includes(streetNumber)) {
      line = `${line} ${streetNumber}`.trim();
    }

    return dedupeRepeatedWords(line);
  }

  if (street) {
    const line = [street, streetNumber].filter(Boolean).join(" ");
    return dedupeRepeatedWords(line);
  }

  return streetNumber;
}

/**
 * Costruisce l'indirizzo completo per la geocodifica:
 * via/indirizzo + civico + CAP + comune + provincia + nazione.
 * Ignora valori vuoti e duplicati.
 */
export function buildFullAddress(parts: CompanyAddressParts): string | null {
  const segments: string[] = [];

  const streetLine = buildStreetLine(parts);
  appendUniquePart(segments, streetLine);
  appendUniquePart(segments, trimValue(parts.postal_code));
  appendUniquePart(segments, trimValue(parts.city));
  appendUniquePart(segments, trimValue(parts.province));
  appendUniquePart(segments, trimValue(parts.country));

  if (segments.length === 0) {
    return null;
  }

  return segments.join(", ").replace(/\s{2,}/g, " ").trim();
}
