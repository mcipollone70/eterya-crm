"use client";

import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { formatDurationMinutes } from "@/lib/last-visit/format";

interface VisitTourSummaryPanelProps {
  stopCount: number;
  totalDistanceKm: number | null;
  drivingMinutes: number | null;
  visitDurationMin: number;
  departureTime: string;
  maxArrivalTime: string;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) {
    return time;
  }

  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMins = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMins).padStart(2, "0")}`;
}

export function VisitTourSummaryPanel({
  stopCount,
  totalDistanceKm,
  drivingMinutes,
  visitDurationMin,
  departureTime,
  maxArrivalTime,
}: VisitTourSummaryPanelProps) {
  const visitMinutes = stopCount * visitDurationMin;
  const totalMinutes = (drivingMinutes ?? 0) + visitMinutes;
  const estimatedArrival = addMinutesToTime(departureTime, totalMinutes);
  const exceedsMax =
    estimatedArrival > maxArrivalTime && departureTime <= maxArrivalTime;

  return (
    <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-sm font-semibold text-slate-900">Riepilogo giro</h4>
      <div className="grid gap-1 text-xs text-slate-700">
        <p>Tappe: {stopCount}</p>
        {totalDistanceKm != null && <p>Distanza: {formatDistanceKm(totalDistanceKm)}</p>}
        {drivingMinutes != null && (
          <p>Tempo guida: {formatDurationMinutes(drivingMinutes)}</p>
        )}
        <p>
          Tempo visite ({visitDurationMin} min cad.): {formatDurationMinutes(visitMinutes)}
        </p>
        <p>Tempo totale stimato: {formatDurationMinutes(totalMinutes)}</p>
        <p>Partenza prevista: {departureTime}</p>
        <p>Arrivo stimato: {estimatedArrival}</p>
        <p>Arrivo massimo: {maxArrivalTime}</p>
      </div>
      {exceedsMax && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Il giro supera l&apos;orario di arrivo massimo impostato.
        </p>
      )}
    </section>
  );
}
