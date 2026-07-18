"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  ORDER_FULFILLMENT_STATUSES,
  type OrderFulfillmentStatusValue,
} from "@/lib/constants/orders";
import { updateOrderStatusAction } from "../actions/order-actions";

interface OrderStatusActionsProps {
  orderId: string;
  companyId: string;
  status: OrderFulfillmentStatusValue | null;
}

const QUICK_FLOW: OrderFulfillmentStatusValue[] = [
  "confermato",
  "in_lavorazione",
  "pronto",
  "consegnato",
];

export function OrderStatusActions({ orderId, companyId, status }: OrderStatusActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentIndex = status ? QUICK_FLOW.indexOf(status) : -1;
  const nextStatus =
    status === "annullato" || status === "bozza"
      ? "confermato"
      : currentIndex >= 0 && currentIndex < QUICK_FLOW.length - 1
        ? QUICK_FLOW[currentIndex + 1]
        : null;

  function handleStatus(next: OrderFulfillmentStatusValue, confirm?: string) {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, companyId, next);
      setMessage(result.message);
      if (result.success) {
        router.refresh();
      }
    });
  }

  if (status === "consegnato" || status === "annullato") {
    return (
      <p className="text-sm text-slate-600">
        Stato: <strong>{status ? ORDER_FULFILLMENT_STATUS_LABELS[status] : "—"}</strong>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Stato:{" "}
        <strong>{status ? ORDER_FULFILLMENT_STATUS_LABELS[status] : "Non impostato"}</strong>
      </p>
      <div className="flex flex-col gap-2">
        {nextStatus && (
          <Button
            type="button"
            size="sm"
            className="w-full justify-start"
            disabled={isPending}
            onClick={() => handleStatus(nextStatus)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Segna come {ORDER_FULFILLMENT_STATUS_LABELS[nextStatus]}
          </Button>
        )}
        {ORDER_FULFILLMENT_STATUSES.filter(
          (item) => item !== status && item !== nextStatus && item !== "bozza"
        )
          .slice(0, 3)
          .map((item) => (
            <Button
              key={item}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={isPending}
              onClick={() =>
                handleStatus(
                  item,
                  item === "annullato" ? "Annullare questo ordine?" : undefined
                )
              }
            >
              {ORDER_FULFILLMENT_STATUS_LABELS[item]}
            </Button>
          ))}
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
