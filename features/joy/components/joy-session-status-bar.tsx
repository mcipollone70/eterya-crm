"use client";

import { Headphones, Loader2, CheckCircle2, Sparkles, ShieldAlert, PauseCircle } from "lucide-react";
import type { JoySessionState } from "../chat/types/joy-session";
import { JOY_SESSION_STATE_LABELS } from "../chat/types/joy-session";

const STATE_STYLES: Record<
  JoySessionState,
  { className: string; Icon: typeof Headphones }
> = {
  listening: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Icon: Headphones,
  },
  thinking: {
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    Icon: Loader2,
  },
  proposing: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: Sparkles,
  },
  confirming: {
    className: "border-orange-200 bg-orange-50 text-orange-900",
    Icon: ShieldAlert,
  },
  completed: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    Icon: CheckCircle2,
  },
  idle: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    Icon: PauseCircle,
  },
};

interface JoySessionStatusBarProps {
  state: JoySessionState;
  conversationMode: boolean;
  guideMode: boolean;
  driveMode?: boolean;
  memoryLabel?: string | null;
}

export function JoySessionStatusBar({
  state,
  conversationMode,
  guideMode,
  driveMode = false,
  memoryLabel,
}: JoySessionStatusBarProps) {
  const style = STATE_STYLES[state];
  const Icon = style.Icon;
  const spin = state === "thinking";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${style.className}`}
        role="status"
        aria-live="polite"
      >
        <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
        {JOY_SESSION_STATE_LABELS[state]}
      </div>
      {conversationMode ? (
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-800">
          Modalità Conversazione
        </span>
      ) : null}
      {driveMode ? (
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-800">
          Joy Drive
        </span>
      ) : guideMode ? (
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
          Guida
        </span>
      ) : null}
      {memoryLabel ? (
        <span
          className="max-w-[min(100%,20rem)] truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
          title={memoryLabel}
        >
          Memoria: {memoryLabel}
        </span>
      ) : null}
    </div>
  );
}
