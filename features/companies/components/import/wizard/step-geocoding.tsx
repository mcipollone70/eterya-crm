import { MapPinOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GEOCODE_STATUS_LABELS,
  type CompanyImportRecord,
} from "../../../types/import";

interface StepGeocodingProps {
  records: CompanyImportRecord[];
}

export function StepGeocoding({ records }: StepGeocodingProps) {
  const preview = records.slice(0, 10);
  const notGeocoded = records.filter((r) => r.geocodeStatus === "not_geocoded").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Geocoding</CardTitle>
          <p className="text-xs text-slate-500">
            Integrazione geocoding in fase 2 — Supabase Edge Function + MapTiler
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="rounded-full bg-amber-100 p-3">
              <MapPinOff className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {notGeocoded.toLocaleString("it-IT")} record con coordinate NON GEOCODIFICATE
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Il geocoding automatico verrà eseguito dopo la connessione al database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stato coordinate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">#</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Ragione sociale</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Indirizzo</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Comune</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Coordinate</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((record, index) => (
                  <tr key={record.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-xs text-slate-400">{index + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{record.name || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.address || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{record.city || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="warning">
                        {GEOCODE_STATUS_LABELS[record.geocodeStatus]}
                      </Badge>
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
