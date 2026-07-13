import * as XLSX from "xlsx";
import type { DetectedColumn, ImportFileAnalysis, MappingConfidence } from "../types/import";
import {
  buildDataRows,
  detectHeaderRow,
  extractHeaders,
  mapHeaderToField,
  normalizeHeader,
  refineSuggestedField,
} from "./detect-headers";

const COLUMN_SAMPLE_SIZE = 25;

function getColumnSampleValues(
  dataRows: string[][],
  columnIndex: number,
  sampleSize = COLUMN_SAMPLE_SIZE
): string[] {
  return dataRows.slice(0, sampleSize).map((row) => row[columnIndex] ?? "");
}

const ACCEPTED_EXTENSIONS = [".xls", ".xlsx"];

const PHONE_PREFIX_HEADERS = new Set([
  "prefisso",
  "prefisso telefonico",
  "prefisso tel",
  "pref tel",
  "pref",
  "prefix",
]);

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function isValidExcelFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name));
}

export async function parseExcelFile(file: File): Promise<ImportFileAnalysis> {
  if (!isValidExcelFile(file)) {
    throw new Error("Formato non supportato. Seleziona un file .xls o .xlsx.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dense: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Il file Excel non contiene fogli di lavoro.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("Il foglio selezionato è vuoto.");
  }

  const headerRowIndex = detectHeaderRow(rawRows);
  const headers = extractHeaders(rawRows, headerRowIndex);
  const columnCount = headers.length;
  const dataRows = buildDataRows(rawRows, headerRowIndex, columnCount);

  const columns: DetectedColumn[] = headers.map((header, index) => {
    const { field, confidence } = mapHeaderToField(header);
    const sampleValues = getColumnSampleValues(dataRows, index);
    const suggestedField = refineSuggestedField(field, sampleValues);
    return {
      index,
      header,
      normalizedHeader: normalizeHeader(header),
      suggestedField,
      confidence: suggestedField === field ? confidence : "low",
    };
  });

  return {
    fileName: file.name,
    sheetName,
    fileSize: file.size,
    headerRowIndex: headerRowIndex + 1,
    columns,
    columnCount,
    companyCount: dataRows.length,
    totalRows: rawRows.length,
    dataRows,
  };
}

export function createInitialMappings(analysis: ImportFileAnalysis) {
  const initial = analysis.columns.map((column) => {
    const sampleValues = getColumnSampleValues(analysis.dataRows, column.index);
    let mappedField = refineSuggestedField(column.suggestedField, sampleValues);

    if (
      mappedField === "phone" &&
      PHONE_PREFIX_HEADERS.has(normalizeHeader(column.header))
    ) {
      mappedField = "phone_prefix";
    }

    return {
      columnIndex: column.index,
      sourceHeader: column.header,
      mappedField,
      confidence: mappedField === column.suggestedField ? column.confidence : ("low" as const),
    };
  });

  const confidenceScore: Record<MappingConfidence, number> = {
    high: 3,
    medium: 2,
    low: 1,
    manual: 4,
  };

  const bestByField = new Map<
    (typeof initial)[number]["mappedField"],
    (typeof initial)[number]
  >();

  for (const mapping of initial) {
    if (mapping.mappedField === "unknown" || mapping.mappedField === "skip") {
      continue;
    }

    const current = bestByField.get(mapping.mappedField);
    if (
      !current ||
      confidenceScore[mapping.confidence] > confidenceScore[current.confidence]
    ) {
      bestByField.set(mapping.mappedField, mapping);
    }
  }

  return initial.map((mapping) => {
    if (mapping.mappedField === "unknown" || mapping.mappedField === "skip") {
      return mapping;
    }

    const winner = bestByField.get(mapping.mappedField);
    if (winner && winner.columnIndex !== mapping.columnIndex) {
      return { ...mapping, mappedField: "unknown" as const, confidence: "low" as const };
    }

    return mapping;
  });
}
