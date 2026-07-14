"use client";

import { useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export type OpportunityKanbanToastVariant = "success" | "error";

interface OpportunityKanbanToastProps {
  message: string;
  variant: OpportunityKanbanToastVariant;
  onDismiss: () => void;
}

export function OpportunityKanbanToast({
  message,
  variant,
  onDismiss,
}: OpportunityKanbanToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  const isSuccess = variant === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-20 left-4 right-4 z-[70] flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg sm:left-auto sm:right-6 sm:max-w-md lg:bottom-6 ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
      )}
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-slate-500 hover:bg-black/5 hover:text-slate-700"
        aria-label="Chiudi notifica"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
