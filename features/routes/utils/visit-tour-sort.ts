import type { VisitTourCandidate, VisitTourSortKey } from "../types/visit-tour";

export function sortVisitTourCandidates(
  candidates: VisitTourCandidate[],
  sortKey: VisitTourSortKey
): VisitTourCandidate[] {
  const sorted = [...candidates];

  switch (sortKey) {
    case "distance":
      sorted.sort((a, b) => a.distanceFromRouteKm - b.distanceFromRouteKm);
      break;
    case "priority":
      sorted.sort((a, b) => b.priorityScore - a.priorityScore);
      break;
    case "lastVisit":
      sorted.sort((a, b) => {
        if (!a.lastVisitAt && !b.lastVisitAt) {
          return 0;
        }
        if (!a.lastVisitAt) {
          return -1;
        }
        if (!b.lastVisitAt) {
          return 1;
        }
        return new Date(a.lastVisitAt).getTime() - new Date(b.lastVisitAt).getTime();
      });
      break;
    case "potential":
      sorted.sort((a, b) => b.potentialScore - a.potentialScore);
      break;
  }

  return sorted;
}
