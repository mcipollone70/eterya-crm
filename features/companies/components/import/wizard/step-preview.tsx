import {
  AlertTriangle,
  Building2,
  Copy,
  FileWarning,
  Mail,
  MapPin,
  MapPinOff,
  Phone,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CompanyImportRecord, ImportPreviewStats } from "../../../types/import";

interface StepPreviewProps {
  stats: ImportPreviewStats;
  records: CompanyImportRecord[];
}

export function StepPreview({ stats, records }: StepPreviewProps) {
  const statCards = [
    { label: "Totale aziende", value: stats.totalCompanies, icon: Building2, variant: "default" as const },
    { label: "Duplicati Partita IVA", value: stats.duplicateVatNumbers, icon: Copy, variant: "warning" as const },
    { label: "Duplicati Codice Fiscale", value: stats.duplicateTaxCodes, icon: Copy, variant: "warning" as const },
    { label: "Record incompleti", value: stats.incompleteRecords, icon: FileWarning, variant: "warning" as const },
    { label: "Senza telefono", value: stats.withoutPhone, icon: Phone, variant: "muted" as const },
    { label: "Senza email", value: stats.withoutEmail, icon: Mail, variant: "muted" as const },
    { label: "Senza indirizzo", value: stats.withoutAddress, icon: MapPin, variant: "muted" as const },
    { label: "Record geocodificati", value: stats.geocodedRecords, icon: MapPinOff, variant: "info" as const },
    { label: "Record da correggere", value: stats.recordsToFix, icon: Wrench, variant: "danger" as const },
  ];

  const preview = records.slice(0, 10);
  const recordsWithIssues = records.filter((r) => r.needsFix).slice(0, 5);

  return (
    <div className="space-y-6">
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Ragione sociale</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">P.IVA</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">C.F.</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Indirizzo</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Email</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Telefono</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Coordinate</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{record.name || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.vatNumber || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.taxCode || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.address || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.email || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.phone || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="warning">NON GEOCODIFICATE</Badge>
                    </td>
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
