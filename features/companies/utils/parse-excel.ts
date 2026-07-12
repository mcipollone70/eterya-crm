import * as XLSX from "xlsx";
import type { DetectedColumn, ImportFileAnalysis } from "../types/import";
import {
  buildDataRows,
  detectHeaderRow,
  extractHeaders,
  mapHeaderToField,
  normalizeHeader,
} from "./detect-headers";

const ACCEPTED_EXTENSIONS = [".xls", ".xlsx"];

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

  const columns: DetectedColumn[] = headers.map((header, index) => {
    const { field, confidence } = mapHeaderToField(header);
    return {
      index,
      header,
      normalizedHeader: normalizeHeader(header),
      suggestedField: field,
      confidence,
    };
  });

  const dataRows = buildDataRows(rawRows, headerRowIndex, columnCount);

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
  return analysis.columns.map((column) => ({
    columnIndex: column.index,
    sourceHeader: column.header,
    mappedField: column.suggestedField,
    confidence: column.confidence,
  }));
}
