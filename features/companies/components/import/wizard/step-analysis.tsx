import { FileSpreadsheet, Columns3, Rows3, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImportFileAnalysis } from "../../../types/import";

interface StepAnalysisProps {
  analysis: ImportFileAnalysis;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StepAnalysis({ analysis }: StepAnalysisProps) {
  const stats = [
    { label: "File", value: analysis.fileName, icon: FileSpreadsheet },
    { label: "Foglio", value: analysis.sheetName, icon: FileSpreadsheet },
    { label: "Dimensione", value: formatFileSize(analysis.fileSize), icon: FileSpreadsheet },
    { label: "Colonne", value: String(analysis.columnCount), icon: Columns3 },
    { label: "Righe totali", value: String(analysis.totalRows), icon: Rows3 },
    { label: "Aziende rilevate", value: String(analysis.companyCount), icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analisi del file</CardTitle>
          <p className="text-xs text-slate-500">
            Intestazione rilevata alla riga {analysis.headerRowIndex}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
              >
                <div className="rounded-lg bg-indigo-50 p-2">
                  <Icon className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="truncate text-sm font-semibold text-slate-900" title={value}>
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colonne rilevate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analysis.columns.map((column) => (
              <Badge key={column.index} variant="info">
                {column.header}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
