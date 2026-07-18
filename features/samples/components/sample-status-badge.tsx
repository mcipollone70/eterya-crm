import { Badge } from "@/components/ui";
import {
  SAMPLE_STATUS_LABELS,
  sampleStatusVariant,
} from "@/lib/constants/samples";
import type { SampleStatus } from "@/lib/supabase/types";

interface SampleStatusBadgeProps {
  status: SampleStatus;
}

export function SampleStatusBadge({ status }: SampleStatusBadgeProps) {
  return <Badge variant={sampleStatusVariant(status)}>{SAMPLE_STATUS_LABELS[status]}</Badge>;
}
