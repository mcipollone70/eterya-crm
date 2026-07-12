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
import { buildCompanyInsertRows } from "../../../utils/build-db-rows";
import { importCompaniesAction } from "../../../actions/import-companies";
import type { ImportResult } from "../../../services/import.service";

interface StepImportProps {
  analysis: ImportFileAnalysis | null;
  records: CompanyImportRecord[];
  stats: ImportPreviewStats | null;
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
      const importResult = await importCompaniesAction(rows);
      setResult(importResult);
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
            Importate{" "}
            <span className="font-semibold text-slate-900">
              {result.importedCount.toLocaleString("it-IT")}
            </span>{" "}
            aziende nel database
            {result.skippedCount > 0 && (
              <>
                {" "}·{" "}
                <span className="font-semibold text-amber-600">
                  {result.skippedCount.toLocaleString("it-IT")} saltate
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
