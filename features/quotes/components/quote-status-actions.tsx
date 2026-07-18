"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants/quotes";
import { updateQuoteStatusAction } from "../actions/quote-actions";

interface QuoteStatusActionsProps {
  quoteId: string;
  companyId: string;
  status: QuoteStatus;
}

const QUICK_STATUSES: Array<{
  status: QuoteStatus;
  label: string;
  icon: typeof CheckCircle2;
  confirm?: string;
}> = [
  {
    status: "accepted",
    label: "Segna accettato",
    icon: CheckCircle2,
    confirm: "Accettare questo preventivo e convertirlo in ordine?",
  },
  {
    status: "rejected",
    label: "Segna rifiutato",
    icon: XCircle,
    confirm: "Segnare questo preventivo come rifiutato?",
  },
  {
    status: "expired",
    label: "Segna scaduto",
    icon: Clock,
    confirm: "Segnare questo preventivo come scaduto?",
  },
];

export function QuoteStatusActions({ quoteId, companyId, status }: QuoteStatusActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const available = QUICK_STATUSES.filter((item) => item.status !== status);
  if (available.length === 0 || status === "cancelled") {
    return null;
  }

  function handleStatus(next: QuoteStatus, confirm?: string) {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await updateQuoteStatusAction(quoteId, companyId, next);
      setMessage(result.message);
      if (result.success) {
        if (next === "accepted" && result.orderId) {
          router.push(`/ordini/${result.orderId}`);
          return;
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Cambio stato rapido
      </p>
      <div className="flex flex-col gap-2">
        {available.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.status}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={isPending}
              onClick={() => handleStatus(item.status, item.confirm)}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {item.label}
            </Button>
          );
        })}
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
      <p className="text-xs text-slate-500">
        Stato attuale: {QUOTE_STATUS_LABELS[status]}.
      </p>
    </div>
  );
}
