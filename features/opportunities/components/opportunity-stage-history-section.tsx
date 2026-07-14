import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { formatVisitDate } from "@/lib/last-visit/format";
import { listOpportunityStageHistory } from "../services/opportunities.service";

interface OpportunityStageHistorySectionProps {
  opportunityId: string;
}

export async function OpportunityStageHistorySection({
  opportunityId,
}: OpportunityStageHistorySectionProps) {
  const { data: items, error } = await listOpportunityStageHistory(opportunityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storico modifiche ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nessuna modifica registrata per questa opportunità.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-slate-200 pl-6">
            {items.map((item) => (
              <li key={item.id} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-100" />
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatVisitDate(item.changed_at)}
                    </p>
                    {item.changed_by_name && (
                      <Badge variant="muted">{item.changed_by_name}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {item.from_stage
                      ? `${OPPORTUNITY_STAGE_LABELS[item.from_stage]} → ${OPPORTUNITY_STAGE_LABELS[item.to_stage as OpportunityStage]}`
                      : OPPORTUNITY_STAGE_LABELS[item.to_stage as OpportunityStage]}
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-sm text-slate-600">{item.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
