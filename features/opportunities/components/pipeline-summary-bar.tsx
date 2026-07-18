import { Badge } from "@/components/ui";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { computeStageTotals } from "@/lib/opportunities/stage-totals";
import type { OpportunityListItem } from "../services/opportunities.service";

interface PipelineSummaryBarProps {
  items: OpportunityListItem[];
  totalCount: number;
  filteredCount: number;
}

export function PipelineSummaryBar({ items, totalCount, filteredCount }: PipelineSummaryBarProps) {
  const openItems = items.filter((item) => isOpenOpportunityStage(item.stage));
  const openValue = openItems.reduce((sum, item) => sum + item.total_amount, 0);
  const stageTotals = computeStageTotals(items).filter((entry) => entry.count > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">
          {openItems.length.toLocaleString("it-IT")} aperte ·{" "}
          {formatOpportunityAmount(openValue)}
        </Badge>
        <Badge variant="muted">
          {filteredCount.toLocaleString("it-IT")} visualizzate
          {filteredCount !== totalCount
            ? ` su ${totalCount.toLocaleString("it-IT")} totali`
            : ""}
        </Badge>
      </div>

      {stageTotals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stageTotals.map((entry) => (
            <span
              key={entry.stage}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
            >
              <span className="font-medium text-slate-900">
                {OPPORTUNITY_STAGE_LABELS[entry.stage]}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span>
                {entry.count} · {formatOpportunityAmount(entry.totalAmount)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
