"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { JoyCopilotOperation } from "../../chat/types/joy-chat";

interface JoyAutonomousConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function JoyAutonomousConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  loading = false,
  onConfirm,
  onCancel,
}: JoyAutonomousConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-violet-200 bg-white p-5 shadow-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Conferma azione Joy
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {actionLabel}
          </Button>
          <Button type="button" variant="outline" disabled={loading} onClick={onCancel}>
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}

export type JoyAutonomousPendingExecution = {
  title: string;
  description: string;
  operation: JoyCopilotOperation;
  href?: string;
} | null;
