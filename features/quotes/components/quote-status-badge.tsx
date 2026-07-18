import { Badge } from "@/components/ui";
import {
  QUOTE_STATUS_LABELS,
  quoteStatusVariant,
  type QuoteStatus,
} from "@/lib/constants/quotes";

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return <Badge variant={quoteStatusVariant(status)}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}
