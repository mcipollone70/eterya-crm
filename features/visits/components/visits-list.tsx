import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ListEmptyState } from "@/components/ui";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import { formatVisitDate } from "@/lib/last-visit/format";
import { CompleteVisitForm } from "./complete-visit-form";
import type { VisitListItem } from "../services/visits.service";

const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Pianificata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  no_show: "Assente",
};

interface VisitsListProps {
  visits: VisitListItem[];
  emptyMessage?: string;
}

function statusVariant(status: VisitListItem["status"]) {
  if (status === "completed") {
    return "success" as const;
  }
  if (status === "scheduled") {
    return "info" as const;
  }
  if (status === "in_progress") {
    return "warning" as const;
  }
  return "muted" as const;
}

export function VisitsList({
  visits,
  emptyMessage = "Nessuna visita in questo periodo.",
}: VisitsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda visite ({visits.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {visits.length === 0 ? (
          <ListEmptyState
            icon={MapPin}
            title="Nessuna visita in elenco"
            message={emptyMessage}
            action={
              <Link href="/routes">
                <Button size="lg" variant="outline">
                  Apri Giro visite
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visits.map((visit) => {
              const canComplete =
                visit.status === "scheduled" || visit.status === "in_progress";
              const eventDate = visit.completed_at ?? visit.scheduled_at;
              const location = [visit.company_city, visit.company_province]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={visit.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatVisitDate(eventDate)}
                        </p>
                        <Badge variant={statusVariant(visit.status)}>
                          {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
                        </Badge>
                        {visit.outcome && (
                          <Badge variant="default">{getVisitOutcomeLabel(visit.outcome)}</Badge>
                        )}
                      </div>

                      {visit.company_name && (
                        <p className="text-sm text-slate-700">
                          <Link
                            href={`/visits?company=${visit.company_id}&briefing=${visit.company_id}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {visit.company_name}
                          </Link>
                          {location ? (
                            <span className="text-slate-500"> · {location}</span>
                          ) : null}
                        </p>
                      )}

                      {visit.notes && (
                        <p className="text-sm text-slate-600">{visit.notes}</p>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
                      <Link
                        href={`/visits?company=${visit.company_id}&briefing=${visit.company_id}`}
                        className="block"
                      >
                        <Button size="lg" variant="outline" className="w-full sm:w-auto">
                          <Sparkles className="h-4 w-4" />
                          Briefing
                        </Button>
                      </Link>
                      {canComplete ? (
                        <CompleteVisitForm
                          visitId={visit.id}
                          companyId={visit.company_id}
                          defaultNotes={visit.notes}
                        />
                      ) : (
                        <Link href={companyRegisterVisitHref(visit.company_id)} className="block">
                          <Button size="lg" variant="outline" className="w-full sm:w-auto sm:h-8 sm:px-3 sm:text-xs">
                            Scheda
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
