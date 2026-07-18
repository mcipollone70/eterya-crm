"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  CompanyImportBrandOptions,
  CompanyImportRecord,
  ImportFileAnalysis,
  ImportPreviewStats,
} from "../../../types/import";
import {
  buildCompanyImportPayloads,
  type CompanyImportRowPayload,
} from "../../../utils/build-db-rows";
import { importCompaniesAction } from "../../../actions/import-companies";
import type { ImportResult } from "../../../services/import.service";
import { IMPORT_RELATIONSHIP_UI_OPTIONS } from "../../../types/import";

interface StepImportProps {
  analysis: ImportFileAnalysis | null;
  records: CompanyImportRecord[];
  stats: ImportPreviewStats | null;
  brandOptions: CompanyImportBrandOptions;
}

const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_REPORTED_ERRORS = 50;

function chunkPayloadsBySize(
  payloads: CompanyImportRowPayload[],
  maxBytes: number
): CompanyImportRowPayload[][] {
  const chunks: CompanyImportRowPayload[][] = [];
  let current: CompanyImportRowPayload[] = [];
  let currentBytes = 0;

  for (const payload of payloads) {
    const rowBytes = JSON.stringify(payload).length;
    if (current.length > 0 && currentBytes + rowBytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(payload);
    currentBytes += rowBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function emptyAggregate(): ImportResult {
  return {
    success: false,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    brandLinksCreated: 0,
    brandLinksUpdated: 0,
    duplicatesAvoided: 0,
    errors: [],
    rowErrors: [],
  };
}

function csvEscape(value: string | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadErrorsCsv(result: ImportResult): void {
  const lines = [
    "riga,nome,codice,messaggio,details,hint,operazione,motivo",
  ];
  for (const row of result.rowErrors) {
    lines.push(
      [
        row.rowIndex,
        csvEscape(row.name),
        csvEscape(row.code),
        csvEscape(row.message),
        csvEscape(row.details),
        csvEscape(row.hint),
        csvEscape(row.operation),
        csvEscape(row.reason),
      ].join(",")
    );
  }
  if (result.rowErrors.length === 0) {
    for (const error of result.errors) {
      lines.push(`,${csvEscape("")},${csvEscape("")},${csvEscape(error)},,,,`);
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `import-errori-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function relationshipLabel(status: CompanyImportBrandOptions["relationshipStatus"]): string {
  return (
    IMPORT_RELATIONSHIP_UI_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

export function StepImport({
  analysis,
  records,
  stats,
  brandOptions,
}: StepImportProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  const total = stats?.totalCompanies ?? records.length;
  const hasBrand = Boolean(brandOptions.brandId.trim());

  const runImport = () => {
    if (!analysis || !hasBrand) return;
    setResult(null);
    startTransition(async () => {
      const payloads = buildCompanyImportPayloads(
        analysis,
        records,
        analysis.fileName,
        brandOptions.relationshipStatus
      );
      const chunks = chunkPayloadsBySize(payloads, MAX_CHUNK_BYTES);
      const aggregate = emptyAggregate();

      for (const chunk of chunks) {
        try {
          const chunkResult = await importCompaniesAction(chunk, brandOptions);

          // Errore JSON / body troncato: non trattare come successo
          if (
            chunkResult == null ||
            typeof chunkResult !== "object" ||
            !("importedCount" in chunkResult)
          ) {
            aggregate.errors.push(
              "Risposta import non valida (possibile errore di serializzazione)."
            );
            continue;
          }

          aggregate.importedCount += chunkResult.importedCount ?? 0;
          aggregate.updatedCount += chunkResult.updatedCount ?? 0;
          aggregate.skippedCount += chunkResult.skippedCount ?? 0;
          aggregate.brandLinksCreated += chunkResult.brandLinksCreated ?? 0;
          aggregate.brandLinksUpdated += chunkResult.brandLinksUpdated ?? 0;
          aggregate.duplicatesAvoided += chunkResult.duplicatesAvoided ?? 0;
          aggregate.rowErrors.push(...(chunkResult.rowErrors ?? []));
          if (aggregate.errors.length < MAX_REPORTED_ERRORS) {
            aggregate.errors.push(
              ...(chunkResult.errors ?? []).slice(
                0,
                MAX_REPORTED_ERRORS - aggregate.errors.length
              )
            );
          }
        } catch (err) {
          if (aggregate.errors.length < MAX_REPORTED_ERRORS) {
            aggregate.errors.push(
              err instanceof Error
                ? err.message
                : "Errore imprevisto durante l'import."
            );
          }
        }
      }

      aggregate.success =
        aggregate.importedCount > 0 ||
        aggregate.updatedCount > 0 ||
        aggregate.brandLinksCreated > 0 ||
        aggregate.brandLinksUpdated > 0;
      setResult(aggregate);
    });
  };

  if (result && (result.success || result.errors.length > 0 || result.rowErrors.length > 0)) {
    const showAsDone = result.success || result.rowErrors.length > 0 || result.skippedCount > 0;
    if (showAsDone) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.success ? "Report importazione" : "Importazione con errori"}
            </CardTitle>
            <p className="text-xs text-slate-500">
              Brand: <strong>{brandOptions.brandName || brandOptions.brandId}</strong>
              {" · "}
              Relazione: {relationshipLabel(brandOptions.relationshipStatus)}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  result.success ? "bg-emerald-100" : "bg-amber-100"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-amber-600" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Aziende create", value: result.importedCount },
                { label: "Aziende aggiornate", value: result.updatedCount },
                { label: "Associazioni Brand create", value: result.brandLinksCreated },
                { label: "Associazioni Brand aggiornate", value: result.brandLinksUpdated },
                { label: "Duplicati evitati", value: result.duplicatesAvoided },
                { label: "Righe saltate", value: result.skippedCount },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-center"
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {item.value.toLocaleString("it-IT")}
                  </p>
                </div>
              ))}
            </div>

            {(result.rowErrors.length > 0 || result.errors.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800">
                    Errori ({result.rowErrors.length || result.errors.length})
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadErrorsCsv(result)}
                  >
                    <Download className="h-4 w-4" />
                    Scarica CSV errori
                  </Button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
                  {result.rowErrors.length > 0
                    ? result.rowErrors.slice(0, 40).map((row, index) => (
                        <p key={`${row.rowIndex}-${index}`}>
                          Riga {row.rowIndex} — {row.name || "—"} — [
                          {row.code || "NO_CODE"}]:{" "}
                          {row.message || row.reason}
                        </p>
                      ))
                    : result.errors.map((error, index) => (
                        <p key={index}>{error}</p>
                      ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Link href="/companies">
                <Button size="lg">Vai alle aziende</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importazione nel database</CardTitle>
        <p className="text-xs text-slate-500">
          Brand: <strong>{brandOptions.brandName || "—"}</strong>
          {" · "}
          Relazione: {relationshipLabel(brandOptions.relationshipStatus)}
          {" · "}
          Principale se assente: {brandOptions.setPrimaryIfNone ? "sì" : "no"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
          <Database className="h-8 w-8 text-indigo-500" />
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Pronti per l&apos;importazione di{" "}
          <span className="font-semibold text-slate-900">
            {total.toLocaleString("it-IT")}
          </span>{" "}
          aziende con associazione Brand.
        </p>

        {result && !result.success && (
          <div className="mt-4 max-w-lg space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs text-red-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Importazione non riuscita
            </div>
            {result.errors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
            {result.rowErrors.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => downloadErrorsCsv(result)}
              >
                <Download className="h-4 w-4" />
                Scarica CSV errori
              </Button>
            )}
          </div>
        )}

        <Button
          size="lg"
          className="mt-8"
          onClick={runImport}
          disabled={isPending || !analysis || !hasBrand || total === 0}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importazione in corso...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              IMPORTA NEL DATABASE
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
