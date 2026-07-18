"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { BackupSummaryRow } from "../services/backup.service";
import { generateBackupAction, restoreBackupAction } from "../actions/backup-actions";

export function BackupScreen() {
  const [exporting, startExport] = useTransition();
  const [restoring, startRestore] = useTransition();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [summary, setSummary] = useState<BackupSummaryRow[] | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  function handleExport() {
    setExportMessage(null);
    startExport(async () => {
      const result = await generateBackupAction();
      if (!result.success || !result.content || !result.fileName) {
        setExportMessage(result.message);
        return;
      }
      const blob = new Blob([result.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportMessage(result.message);
      setSummary(result.summary ?? null);
    });
  }

  function handleRestore() {
    if (!restoreFile) {
      setRestoreMessage({ text: "Seleziona un file di backup JSON.", ok: false });
      return;
    }
    setRestoreMessage(null);
    startRestore(async () => {
      const content = await restoreFile.text();
      const result = await restoreBackupAction(content);
      setRestoreMessage({ text: result.message, ok: result.success });
      if (result.success) {
        setSummary(result.summary ?? null);
        setConfirmRestore(false);
        setRestoreFile(null);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Esporta backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-slate-600">
            Scarica un file JSON completo con aziende, contatti, opportunità, preventivi,
            ordini, campioni, ticket e configurazione. I file allegati fisici non sono inclusi
            (solo i riferimenti).
          </p>
          <Button type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Esporta backup JSON
          </Button>
          {exportMessage ? <p className="text-sm text-emerald-700">{exportMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ripristina backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-slate-600">
            Importa un file di backup. Il ripristino è <strong>non distruttivo</strong>: inserisce
            solo i record mancanti (per identificativo) e <strong>non modifica né elimina</strong>{" "}
            i dati esistenti.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmRestore}
              onChange={(event) => setConfirmRestore(event.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>Confermo di voler importare i record mancanti da questo file.</span>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={handleRestore}
            disabled={restoring || !confirmRestore || !restoreFile}
          >
            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Ripristina da file
          </Button>
          {restoreMessage ? (
            <p className={`text-sm ${restoreMessage.ok ? "text-emerald-700" : "text-rose-700"}`}>
              {restoreMessage.text}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {summary ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-slate-500" />
              Riepilogo record
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {summary.map((row) => (
                <div
                  key={row.table}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="truncate text-xs font-medium text-slate-600">{row.table}</p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {row.count.toLocaleString("it-IT")}
                  </p>
                  {row.error ? <p className="text-[11px] text-amber-600">{row.error}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
