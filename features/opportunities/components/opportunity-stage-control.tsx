"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { updateOpportunityStageAction } from "../actions/opportunity-actions";
import {
  OpportunityKanbanToast,
  type OpportunityKanbanToastVariant,
} from "./opportunity-kanban-toast";

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
  const [toast, setToast] = useState<{ message: string; variant: OpportunityKanbanToastVariant } | null>(
    null
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  function handleChange(stage: OpportunityStage) {
    if (stage === currentStage) {
      return;
    }

    startTransition(async () => {
      const result = await updateOpportunityStageAction(opportunityId, companyId, stage);
      if (!result.success) {
        setToast({ message: result.message, variant: "error" });
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
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

      {toast ? (
        <OpportunityKanbanToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}
