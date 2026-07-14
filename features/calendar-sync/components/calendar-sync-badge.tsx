import { Badge } from "@/components/ui";
import type { CalendarSyncStatus } from "@/lib/google-calendar/types";

const LABELS: Record<CalendarSyncStatus, string> = {
  synced: "Google",
  pending: "Sync…",
  error: "Errore sync",
  deleted: "Rimosso",
};

const VARIANTS: Record<
  CalendarSyncStatus,
  "success" | "info" | "warning" | "muted"
> = {
  synced: "success",
  pending: "info",
  error: "warning",
  deleted: "muted",
};

interface CalendarSyncBadgeProps {
  status?: CalendarSyncStatus | string | null;
}

export function CalendarSyncBadge({ status }: CalendarSyncBadgeProps) {
  if (!status || status === "deleted") {
    return null;
  }

  const normalized = status as CalendarSyncStatus;

  return (
    <Badge variant={VARIANTS[normalized] ?? "muted"} title="Stato sincronizzazione Google Calendar">
      {LABELS[normalized] ?? status}
    </Badge>
  );
}
