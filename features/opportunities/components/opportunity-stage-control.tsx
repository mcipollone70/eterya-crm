"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { updateOpportunityStageAction } from "../actions/opportunity-actions";

interface OpportunityStageControlProps {
  opportunityId: string;
  companyId: string;
  currentStage: OpportunityStage;
}

export function OpportunityStageControl({
  opportunityId,
  companyId,
  currentStage,
}: OpportunityStageControlProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(stage: OpportunityStage) {
    if (stage === currentStage) {
      return;
    }

    startTransition(async () => {
      await updateOpportunityStageAction(opportunityId, companyId, stage);
      router.refresh();
    });
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Fase pipeline</span>
      <select
        value={currentStage}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as OpportunityStage)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
      >
        {OPPORTUNITY_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {OPPORTUNITY_STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
    </label>
  );
}
