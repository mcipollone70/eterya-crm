"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import {
  formatOpportunityAmount,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { groupOpportunitiesByStage } from "@/lib/opportunities/kanban";
import { updateOpportunityStageAction } from "../actions/opportunity-actions";
import type { OpportunityListItem } from "../services/opportunities.service";

interface OpportunityKanbanProps {
  items: OpportunityListItem[];
}

function priorityVariant(probability: number | null) {
  if (probability == null) {
    return "muted" as const;
  }
  if (probability >= 70) {
    return "success" as const;
  }
  if (probability >= 40) {
    return "warning" as const;
  }
  return "danger" as const;
}

export function OpportunityKanban({ items }: OpportunityKanbanProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const grouped = groupOpportunitiesByStage(items);

  function handleStageChange(opportunityId: string, companyId: string, stage: OpportunityStage) {
    startTransition(async () => {
      await updateOpportunityStageAction(opportunityId, companyId, stage);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {OPPORTUNITY_STAGES.map((stage) => (
          <div
            key={stage}
            className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50/80"
          >
            <div className="border-b border-slate-200 px-3 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {OPPORTUNITY_STAGE_LABELS[stage]}
              </h3>
              <p className="text-xs text-slate-500">{grouped[stage].length} opportunità</p>
            </div>

            <div className="space-y-3 p-3">
              {grouped[stage].map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {item.company_name && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <Link
                        href={`/companies/${item.company_id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {item.company_name}
                      </Link>
                      <Link
                        href={companyRegisterVisitHref(item.company_id)}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        <MapPin className="h-3 w-3" />
                        Visita
                      </Link>
                    </p>
                  )}
                  {item.contact_name && (
                    <p className="mt-1 text-xs text-slate-500">Referente: {item.contact_name}</p>
                  )}
                  <Badge variant="info">{PRODUCT_FAMILY_LABELS[item.product_family]}</Badge>
                  {item.product_names.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">{item.product_names.join(", ")}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {formatOpportunityAmount(item.total_amount, item.currency)}
                    </span>
                    <Badge variant={priorityVariant(item.probability)}>
                      {item.probability ?? 0}%
                    </Badge>
                  </div>
                  {item.expected_close_at && (
                    <p className="mt-2 text-xs text-slate-500">
                      Chiusura prevista:{" "}
                      {new Date(item.expected_close_at).toLocaleDateString("it-IT")}
                    </p>
                  )}

                  <label className="mt-3 block text-xs text-slate-500">
                    Sposta fase
                    <select
                      value={item.stage}
                      disabled={isPending}
                      onChange={(event) =>
                        handleStageChange(item.id, item.company_id, event.target.value as OpportunityStage)
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
                    >
                      {OPPORTUNITY_STAGES.map((option) => (
                        <option key={option} value={option}>
                          {OPPORTUNITY_STAGE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
