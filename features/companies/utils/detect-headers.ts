import type { CompanyImportField } from "../types/import";

interface HeaderPattern {
  field: CompanyImportField;
  keywords: string[];
}

const HEADER_PATTERNS: HeaderPattern[] = [
  {
    field: "name",
    keywords: [
      "ragione sociale",
      "denominazione",
      "azienda",
      "company",
      "nome azienda",
      "societa",
      "società",
      "cliente",
      "name",
      "business name",
    ],
  },
  {
    field: "vat_number",
    keywords: ["partita iva", "p.iva", "p iva", "vat", "pi", "tax id"],
  },
  {
    field: "tax_code",
    keywords: ["codice fiscale", "cf", "c.f.", "cod fiscale"],
  },
  {
    field: "street",
    keywords: ["via", "indirizzo via", "strada", "street name", "nome via"],
  },
  {
    field: "street_number",
    keywords: ["civico", "n civico", "numero civico", "n.", "numero", "street number"],
  },
  {
    field: "address",
    keywords: ["indirizzo", "address", "sede legale", "sede", "indirizzo completo"],
  },
  {
    field: "city",
    keywords: ["citta", "città", "comune", "city", "localita", "località"],
  },
  {
    field: "province",
    keywords: ["provincia", "prov", "province", "state", "sigla prov"],
  },
  {
    field: "postal_code",
    keywords: ["cap", "codice postale", "postal code", "zip", "zip code"],
  },
  {
    field: "country",
    keywords: ["nazione", "country", "stato", "paese"],
  },
  {
    field: "email",
    keywords: ["email", "e-mail", "mail", "posta elettronica"],
  },
  {
    field: "phone",
    keywords: ["telefono", "tel", "phone", "cellulare", "mobile", "fax"],
  },
  {
    field: "contact_name",
    keywords: ["referente", "contatto", "contact", "nome referente", "persona di contatto"],
  },
  {
    field: "website",
    keywords: ["sito", "website", "web", "url", "sito web"],
  },
  {
    field: "notes",
    keywords: ["note", "notes", "osservazioni", "commenti", "descrizione"],
  },
];

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeaderToField(header: string): {
  field: CompanyImportField;
  confidence: "high" | "medium" | "low";
} {
  const normalized = normalizeHeader(header);

  if (!normalized) {
    return { field: "unknown", confidence: "low" };
  }

  for (const pattern of HEADER_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalized === keyword) {
        return { field: pattern.field, confidence: "high" };
      }
    }
  }

  for (const pattern of HEADER_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword) || keyword.includes(normalized)) {
        return { field: pattern.field, confidence: "medium" };
      }
    }
  }

  return { field: "unknown", confidence: "low" };
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("it-IT");
  }
  return String(value).trim();
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => cellToString(cell) === "");
}

function scoreHeaderRow(row: unknown[]): number {
  const cells = row.map(cellToString).filter(Boolean);
  if (cells.length < 2) return 0;

  let score = cells.length;

  for (const cell of cells) {
    const { field, confidence } = mapHeaderToField(cell);
    if (field !== "unknown") {
      score += confidence === "high" ? 5 : confidence === "medium" ? 3 : 1;
    }
    if (/^\d+([.,]\d+)?$/.test(cell)) {
      score -= 2;
    }
  }

  return score;
}

export function detectHeaderRow(rows: unknown[][]): number {
  const scanLimit = Math.min(rows.length, 15);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const score = scoreHeaderRow(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function extractHeaders(rows: unknown[][], headerRowIndex: number): string[] {
  const headerRow = rows[headerRowIndex] ?? [];
  const headers: string[] = [];
  let emptyStreak = 0;

  for (let i = 0; i < headerRow.length; i++) {
    const value = cellToString(headerRow[i]);
    if (!value) {
      emptyStreak++;
      if (emptyStreak >= 3 && headers.length > 0) break;
      headers.push(`Colonna ${i + 1}`);
      continue;
    }
    emptyStreak = 0;
    headers.push(value);
  }

  return headers;
}

export function buildDataRows(
  rows: unknown[][],
  headerRowIndex: number,
  columnCount: number
): string[][] {
  const dataRows: string[][] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const normalized = Array.from({ length: columnCount }, (_, col) =>
      cellToString(row[col])
    );

    if (!isRowEmpty(normalized)) {
      dataRows.push(normalized);
    }
  }

  return dataRows;
}

export { mapHeaderToField, normalizeHeader, cellToString };
