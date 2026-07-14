"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  CLOSED_LOST_STAGE,
  CLOSED_WON_STAGE,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { closeOpportunityAction } from "../actions/opportunity-actions";

interface OpportunityCloseButtonProps {
  opportunityId: string;
  companyId: string;
  isClosed: boolean;
}

export function OpportunityCloseButton({
  opportunityId,
  companyId,
  isClosed,
}: OpportunityCloseButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<typeof CLOSED_WON_STAGE | typeof CLOSED_LOST_STAGE>(
    CLOSED_WON_STAGE
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isClosed) {
    return null;
  }

  function handleClose() {
    setMessage(null);
    setError(null);

    const label = OPPORTUNITY_STAGE_LABELS[outcome];
    if (!window.confirm(`Chiudere l'opportunità come "${label}"?`)) {
      return;
    }

    startTransition(async () => {
      const result = await closeOpportunityAction(opportunityId, companyId, outcome);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(true)}>
        <CheckCircle2 className="h-4 w-4" />
        Chiudi opportunità
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:w-auto">
      <label className="block text-xs font-medium text-slate-700">
        Esito chiusura
        <select
          value={outcome}
          onChange={(event) =>
            setOutcome(event.target.value as typeof CLOSED_WON_STAGE | typeof CLOSED_LOST_STAGE)
          }
          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value={CLOSED_WON_STAGE}>{OPPORTUNITY_STAGE_LABELS.won}</option>
          <option value={CLOSED_LOST_STAGE}>{OPPORTUNITY_STAGE_LABELS.lost}</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleClose}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Conferma chiusura
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setIsOpen(false)}
        >
          Annulla
        </Button>
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </div>
  );
}
