"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  CompanyImportRecord,
  ImportFileAnalysis,
  ImportPreviewStats,
} from "../../../types/import";
import { buildCompanyInsertRows, type CompanyInsert } from "../../../utils/build-db-rows";
import { importCompaniesAction } from "../../../actions/import-companies";
import type { ImportResult } from "../../../services/import.service";

interface StepImportProps {
  analysis: ImportFileAnalysis | null;
  records: CompanyImportRecord[];
  stats: ImportPreviewStats | null;
}

// Ogni riga porta con sé l'intero payload Excel (import_payload + 76 slot
// posizionali), quindi l'intero dataset supera facilmente il limite di 10MB
// del body delle Server Action di Next: il body viene troncato e il JSON.parse
// lato server fallisce con "Unterminated string in JSON". Spezziamo l'invio in
// chunk ben sotto il limite in base alla dimensione serializzata reale.
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_REPORTED_ERRORS = 20;

function chunkRowsBySize(
  rows: CompanyInsert[],
  maxBytes: number
): CompanyInsert[][] {
  const chunks: CompanyInsert[][] = [];
  let current: CompanyInsert[] = [];
  let currentBytes = 0;

  for (const row of rows) {
    const rowBytes = JSON.stringify(row).length;
    if (current.length > 0 && currentBytes + rowBytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += rowBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function StepImport({ analysis, records, stats }: StepImportProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  const total = stats?.totalCompanies ?? records.length;

  const runImport = () => {
    if (!analysis) return;
    setResult(null);
    startTransition(async () => {
      const rows = buildCompanyInsertRows(analysis, records, analysis.fileName);
      const chunks = chunkRowsBySize(rows, MAX_CHUNK_BYTES);

      const aggregate: ImportResult = {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errors: [],
      };

      for (const chunk of chunks) {
        try {
          const chunkResult = await importCompaniesAction(chunk);
          aggregate.importedCount += chunkResult.importedCount;
          aggregate.updatedCount += chunkResult.updatedCount;
          aggregate.skippedCount += chunkResult.skippedCount;
          if (aggregate.errors.length < MAX_REPORTED_ERRORS) {
            aggregate.errors.push(
              ...chunkResult.errors.slice(
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
        aggregate.importedCount > 0 || aggregate.updatedCount > 0;
      setResult(aggregate);
    });
  };

  if (result?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importazione completata</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="mt-4 text-sm text-slate-600">
            {result.importedCount > 0 && (
              <>
                <span className="font-semibold text-slate-900">
                  {result.importedCount.toLocaleString("it-IT")}
                </span>{" "}
                {result.importedCount === 1 ? "nuova azienda" : "nuove aziende"}
              </>
            )}
            {result.importedCount > 0 && result.updatedCount > 0 && " · "}
            {result.updatedCount > 0 && (
              <>
                <span className="font-semibold text-slate-900">
                  {result.updatedCount.toLocaleString("it-IT")}
                </span>{" "}
                {result.updatedCount === 1 ? "aggiornata" : "aggiornate"}
              </>
            )}
            {(result.importedCount > 0 || result.updatedCount > 0) && (
              <> nel database</>
            )}
            {result.importedCount === 0 && result.updatedCount === 0 && (
              <>Nessuna azienda importata nel database</>
            )}
            {result.skippedCount > 0 && (
              <>
                {" "}·{" "}
                <span className="font-semibold text-amber-600">
                  {result.skippedCount.toLocaleString("it-IT")}{" "}
                  {result.skippedCount === 1 ? "saltata" : "saltate"}
                </span>
              </>
            )}
            .
          </p>

          {result.errors.length > 0 && (
            <div className="mt-4 max-w-lg space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-700">
              {result.errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}

          <Link href="/companies" className="mt-8">
            <Button size="lg">Vai alle aziende</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importazione nel database</CardTitle>
        <p className="text-xs text-slate-500">
          I dati puliti verranno scritti su Supabase preservando ogni colonna
          originale del file Excel.
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
          aziende nel database.
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
          </div>
        )}

        <Button
          size="lg"
          className="mt-8"
          onClick={runImport}
          disabled={isPending || !analysis || total === 0}
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
