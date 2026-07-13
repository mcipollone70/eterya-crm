import { Badge } from "@/components/ui";
import {
  COMMERCIAL_STATUS_BADGE_VARIANT,
  COMMERCIAL_STATUS_LABELS,
  normalizeCommercialStatus,
} from "@/lib/constants/commercial-status";
import type { CommercialStatus } from "@/lib/supabase/types";

export function CommercialStatusBadge({
  status,
}: {
  status: CommercialStatus | null | undefined;
}) {
  const normalized = normalizeCommercialStatus(status);
  return (
    <Badge variant={COMMERCIAL_STATUS_BADGE_VARIANT[normalized]}>
      {COMMERCIAL_STATUS_LABELS[normalized]}
    </Badge>
  );
}
