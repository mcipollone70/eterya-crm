import type { VisitTourSaveStatus } from "../types/visit-tour";

export const VISIT_TOUR_STATUS_LABELS: Record<VisitTourSaveStatus, string> = {
  draft: "Bozza",
  planned: "Pianificato",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato",
};

export const VISIT_TOUR_STATUS_OPTIONS: Array<{
  value: VisitTourSaveStatus;
  label: string;
}> = (
  Object.entries(VISIT_TOUR_STATUS_LABELS) as Array<[VisitTourSaveStatus, string]>
).map(([value, label]) => ({ value, label }));

export const VISIT_TOUR_CORRIDOR_RADIUS_OPTIONS = [1, 2, 5, 10, 20] as const;

export type VisitTourCorridorRadiusKm = (typeof VISIT_TOUR_CORRIDOR_RADIUS_OPTIONS)[number];

export const VISIT_TOUR_VISIT_DURATION_OPTIONS = [15, 30, 45, 60] as const;

export type VisitTourVisitDurationMin = (typeof VISIT_TOUR_VISIT_DURATION_OPTIONS)[number];
