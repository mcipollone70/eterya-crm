import { Badge } from "@/components/ui";
import {
  SERVICE_TICKET_STATUS_LABELS,
  serviceTicketStatusVariant,
} from "@/lib/constants/service-tickets";
import type { ServiceTicketStatus } from "@/lib/supabase/types";

interface ServiceTicketStatusBadgeProps {
  status: ServiceTicketStatus;
}

export function ServiceTicketStatusBadge({ status }: ServiceTicketStatusBadgeProps) {
  return (
    <Badge variant={serviceTicketStatusVariant(status)}>
      {SERVICE_TICKET_STATUS_LABELS[status]}
    </Badge>
  );
}
