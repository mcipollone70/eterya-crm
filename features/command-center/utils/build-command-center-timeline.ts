import { getDistanceKm, formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { AgendaItem } from "@/lib/constants/agenda";
import type { JoyDayPlanItem } from "@/features/joy/types/joy-data";
import type { CommandCenterTimelineItem } from "../types/command-center";

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildCommandCenterTimeline(input: {
  dayPlan: JoyDayPlanItem[];
  agendaItems: AgendaItem[];
}): CommandCenterTimelineItem[] {
  const visitItems: CommandCenterTimelineItem[] = input.dayPlan.map((visit) => ({
    id: `visit-${visit.visitId}`,
    scheduledAt: visit.scheduledAt,
    timeLabel: visit.scheduledLabel,
    companyId: visit.companyId,
    companyName: visit.companyName,
    city: visit.city,
    distanceLabel: null,
    phone: visit.phone,
    latitude: visit.latitude,
    longitude: visit.longitude,
    visitId: visit.visitId,
    kind: "visit",
  }));

  const agendaVisits: CommandCenterTimelineItem[] = input.agendaItems
    .filter((item) => item.kind === "visit" && item.companyId)
    .filter((item) => !visitItems.some((visit) => visit.companyId === item.companyId))
    .map((item) => ({
      id: `agenda-${item.id}`,
      scheduledAt: item.scheduledAt,
      timeLabel: formatTimeLabel(item.scheduledAt),
      companyId: item.companyId!,
      companyName: item.companyName ?? item.title,
      city: null,
      distanceLabel: null,
      phone: null,
      latitude: null,
      longitude: null,
      kind: "agenda" as const,
    }));

  const merged = [...visitItems, ...agendaVisits].sort(
    (left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()
  );

  let previousPoint: { lat: number; lng: number } | null = null;

  return merged.map((item) => {
    let distanceLabel: string | null = null;

    if (
      item.latitude != null &&
      item.longitude != null &&
      previousPoint
    ) {
      const km = getDistanceKm(
        previousPoint.lat,
        previousPoint.lng,
        item.latitude,
        item.longitude
      );
      distanceLabel = formatDistanceKm(km);
    }

    if (item.latitude != null && item.longitude != null) {
      previousPoint = { lat: item.latitude, lng: item.longitude };
    }

    return { ...item, distanceLabel };
  });
}
