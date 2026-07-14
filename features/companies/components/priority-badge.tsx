import { PRIORITY_TIER_LABELS } from "@/lib/constants/priority-tier";
import type { PriorityTier } from "@/lib/commercial-priority/types";
import { cn } from "@/utils/cn";

const TIER_STYLES: Record<PriorityTier, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
  none: "bg-slate-50 text-slate-400 border-slate-200",
};

export function PriorityBadge({
  score,
  tier,
}: {
  score: number;
  tier: PriorityTier;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
        TIER_STYLES[tier]
      )}
    >
      {score}
      <span className="opacity-70">· {PRIORITY_TIER_LABELS[tier]}</span>
    </span>
  );
}
