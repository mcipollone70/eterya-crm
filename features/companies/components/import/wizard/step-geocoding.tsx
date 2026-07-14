"use client";

import { CheckCircle2, MapPin, MapPinOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GEOCODE_STATUS_LABELS,
  type CompanyImportRecord,
} from "../../../types/import";

interface StepGeocodingProps {
  records: CompanyImportRecord[];
}

function badgeVariant(
  status: CompanyImportRecord["geocodeStatus"]
): "success" | "warning" | "muted" | "danger" {
  if (status === "completed" || status === "geocoded") {
    return "success";
  }
  if (status === "needs_review") {
    return "warning";
  }
  if (status === "failed") {
    return "danger";
  }
  return "muted";
}

export function StepGeocoding({ records }: StepGeocodingProps) {
  const preview = records.slice(0, 10);
  const geocoded = records.filter(
    (r) => r.geocodeStatus === "completed" || r.geocodeStatus === "geocoded"
  ).length;
  const needsReview = records.filter((r) => r.geocodeStatus === "needs_review").length;
  const notGeocoded = records.filter((r) => r.geocodeStatus === "not_geocoded").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Geocoding Geoapify</CardTitle>
          <p className="text-xs text-slate-500">
            Ogni azienda è stata geolocalizzata automaticamente durante l&apos;import.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-lg font-semibold text-emerald-900">
                {geocoded.toLocaleString("it-IT")}
              </p>
              <p className="text-xs text-emerald-700">Geocodificate</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <MapPin className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-lg font-semibold text-amber-900">
                {needsReview.toLocaleString("it-IT")}
              </p>
              <p className="text-xs text-amber-700">Da verificare</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <MapPinOff className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900">
                {notGeocoded.toLocaleString("it-IT")}
              </p>
              <p className="text-xs text-slate-600">Non geocodificate</p>
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
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500">Stato</th>
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
                      <Badge variant={badgeVariant(record.geocodeStatus)}>
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
