import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  FileWarning,
  Link2,
  Mail,
  MapPin,
  MapPinOff,
  Phone,
  UserX,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CompanyImportBrandOptions,
  CompanyImportRecord,
  ImportPreviewStats,
} from "../../../types/import";
import { IMPORT_RELATIONSHIP_UI_OPTIONS } from "../../../types/import";

interface StepPreviewProps {
  stats: ImportPreviewStats;
  records: CompanyImportRecord[];
  brandOptions: CompanyImportBrandOptions;
}

export function StepPreview({ stats, records, brandOptions }: StepPreviewProps) {
  const relationshipLabel =
    IMPORT_RELATIONSHIP_UI_OPTIONS.find(
      (o) => o.value === brandOptions.relationshipStatus
    )?.label ?? brandOptions.relationshipStatus;

  const statCards = [
    { label: "Righe totali", value: stats.totalCompanies, icon: Building2 },
    { label: "Righe valide", value: stats.validRecords, icon: CheckCircle2 },
    { label: "Senza ragione sociale", value: stats.missingNameRecords, icon: UserX },
    { label: "Duplicati nel file", value: stats.duplicateInFile, icon: Copy },
    {
      label: "Possibili già presenti",
      value: stats.possibleExistingMatches,
      icon: Link2,
    },
    { label: "Duplicati Partita IVA", value: stats.duplicateVatNumbers, icon: Copy },
    { label: "Record incompleti", value: stats.incompleteRecords, icon: FileWarning },
    { label: "Senza telefono", value: stats.withoutPhone, icon: Phone },
    { label: "Senza email", value: stats.withoutEmail, icon: Mail },
    { label: "Senza indirizzo", value: stats.withoutAddress, icon: MapPin },
    { label: "Record geocodificati", value: stats.geocodedRecords, icon: MapPinOff },
    { label: "Record da correggere", value: stats.recordsToFix, icon: Wrench },
  ];

  const preview = records.slice(0, 10);
  const recordsWithIssues = records.filter((r) => r.needsFix).slice(0, 5);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5 text-sm text-slate-700">
          <span>
            Brand:{" "}
            <strong>{brandOptions.brandName || brandOptions.brandId}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Relazione: <strong>{relationshipLabel}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Principale se assente:{" "}
            <strong>{brandOptions.setPrimaryIfNone ? "sì" : "no"}</strong>
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-lg bg-slate-100 p-2.5">
                <Icon className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-slate-900">
                  {value.toLocaleString("it-IT")}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recordsWithIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Record da correggere
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recordsWithIssues.map((record) => (
              <div
                key={record.id}
                className="rounded-lg border border-amber-100 bg-amber-50 p-3"
              >
                <p className="text-sm font-medium text-slate-900">
                  {record.name || `Riga ${record.rowIndex}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {record.issues.map((issue) => (
                    <Badge key={issue} variant="warning">
                      {issue}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Anteprima finale</CardTitle>
          <p className="text-xs text-slate-500">
            Prime {preview.length} righe su {stats.totalCompanies.toLocaleString("it-IT")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Ragione sociale</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">P.IVA</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Cod. cliente</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Comune</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Provincia</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">CAP</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Indirizzo</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Email</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Telefono</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{record.name || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.vatNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.customerCode || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.city || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.province || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.postalCode || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.address || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.email || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">{record.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
