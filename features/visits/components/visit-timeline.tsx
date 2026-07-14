import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import {
  formatDurationMinutes,
  formatVisitDate,
} from "@/lib/last-visit/format";
import type { VisitListItem } from "../services/visits.service";

const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Pianificata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  no_show: "Assente",
};

interface VisitTimelineProps {
  visits: VisitListItem[];
}

export function VisitTimeline({ visits }: VisitTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Storico visite ({visits.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {visits.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nessuna visita nello storico. Registra la prima visita con il pulsante sopra.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-slate-200 pl-6">
            {visits.map((visit) => {
              const eventDate = visit.completed_at ?? visit.scheduled_at;
              return (
                <li key={visit.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-100" />
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatVisitDate(eventDate)}
                      </p>
                      <Badge variant={visit.status === "completed" ? "success" : "default"}>
                        {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
                      </Badge>
                      {visit.outcome && (
                        <Badge variant="info">{getVisitOutcomeLabel(visit.outcome)}</Badge>
                      )}
                    </div>

                    <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Durata
                        </dt>
                        <dd>{formatDurationMinutes(visit.duration_minutes)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Prossimo richiamo
                        </dt>
                        <dd>{formatVisitDate(visit.next_callback_at)}</dd>
                      </div>
                    </dl>

                    {visit.notes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{visit.notes}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
