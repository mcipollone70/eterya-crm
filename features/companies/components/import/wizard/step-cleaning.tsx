import {
  Combine,
  Hash,
  MapPin,
  Building,
  AlignJustify,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CleaningReport, CompanyImportRecord } from "../../../types/import";

interface StepCleaningProps {
  report: CleaningReport;
  records: CompanyImportRecord[];
}

export function StepCleaning({ report, records }: StepCleaningProps) {
  const operations = [
    {
      label: "Via + Civico uniti",
      value: report.mergedStreetNumbers,
      icon: Combine,
    },
    {
      label: "CAP normalizzati",
      value: report.normalizedPostalCodes,
      icon: Hash,
    },
    {
      label: "Province normalizzate",
      value: report.normalizedProvinces,
      icon: MapPin,
    },
    {
      label: "Comuni normalizzati",
      value: report.normalizedCities,
      icon: Building,
    },
    {
      label: "Spazi doppi rimossi",
      value: report.trimmedSpaces,
      icon: AlignJustify,
    },
    {
      label: "Caratteri strani rimossi",
      value: report.removedSpecialChars,
      icon: Sparkles,
    },
  ];

  const preview = records.slice(0, 5);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pulizia dati completata</CardTitle>
          <p className="text-xs text-slate-500">
            {records.length.toLocaleString("it-IT")} record elaborati
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {operations.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
              >
                <div className="rounded-lg bg-emerald-50 p-2">
                  <Icon className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {value.toLocaleString("it-IT")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anteprima record puliti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Ragione sociale</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Indirizzo</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Comune</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">CAP</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Prov.</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((record) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{record.name || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.address || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.city || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.postalCode || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.province || "—"}</td>
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
