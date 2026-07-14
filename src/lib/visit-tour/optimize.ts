import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { minDistanceToRouteKm } from "@/features/routes/utils/route-geometry";
import type { GeoPoint } from "@/features/routes/types/visit-tour";
import {
  VISIT_TOUR_AVG_SPEED_KMH,
  VISIT_TOUR_STOP_MINUTES,
} from "./constants";
import { isVisitTourEligible, type VisitTourCompanyLike } from "./eligibility";
import {
  scoreVisitTourStop,
  type VisitTourOptimizeContext,
} from "./scoring";

export interface VisitTourConstraints {
  maxDurationMinutes: number;
  maxStops: number;
  maxDeviationKm: number;
}

export interface VisitTourOptimizeStop {
  id: string;
  order: number;
  locked: boolean;
  score: number;
  reason: string;
  deviationKm: number;
  legDistanceKm: number;
  detourKm: number;
  company: VisitTourCompanyLike & {
    name: string;
    city?: string | null;
    province?: string | null;
    phone?: string | null;
    revenue?: number | null;
  };
}

export interface VisitTourOptimizePlan {
  stops: VisitTourOptimizeStop[];
  totalDistanceKm: number;
  estimatedMinutes: number;
  totalDeviationKm: number;
}

export interface OptimizeVisitTourInput {
  origin: GeoPoint;
  destination: GeoPoint;
  companies: Array<
    VisitTourCompanyLike & {
      name: string;
      city?: string | null;
      province?: string | null;
      phone?: string | null;
      revenue?: number | null;
    }
  >;
  context: VisitTourOptimizeContext;
  constraints: VisitTourConstraints;
  existingStops?: VisitTourOptimizeStop[];
  originCompanyId?: string;
  destinationCompanyId?: string;
}

function toPoint(company: VisitTourCompanyLike): GeoPoint {
  return { lat: company.latitude, lng: company.longitude };
}

function travelMinutes(distanceKm: number): number {
  return (distanceKm / VISIT_TOUR_AVG_SPEED_KMH) * 60;
}

function calcDetourKm(from: GeoPoint, company: VisitTourCompanyLike, to: GeoPoint): number {
  const direct = getDistanceKm(from.lat, from.lng, to.lat, to.lng);
  const via =
    getDistanceKm(from.lat, from.lng, company.latitude, company.longitude) +
    getDistanceKm(company.latitude, company.longitude, to.lat, to.lng);
  return Math.max(0, via - direct);
}

interface PickBestResult {
  company: OptimizeVisitTourInput["companies"][number];
  score: number;
  reason: string;
  deviationKm: number;
  detourKm: number;
  legDistanceKm: number;
}

function pickBestStop(
  from: GeoPoint,
  segmentEnd: GeoPoint,
  baseRoute: GeoPoint[],
  pool: OptimizeVisitTourInput["companies"],
  usedIds: Set<string>,
  context: VisitTourOptimizeContext,
  constraints: VisitTourConstraints
): PickBestResult | null {
  let best: PickBestResult | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;

  for (const company of pool) {
    if (usedIds.has(company.id)) {
      continue;
    }

    const point = toPoint(company);
    const deviationKm = minDistanceToRouteKm(point, baseRoute);
    if (deviationKm > constraints.maxDeviationKm) {
      continue;
    }

    const legDistanceKm = getDistanceKm(from.lat, from.lng, point.lat, point.lng);
    const detourKm = calcDetourKm(from, company, segmentEnd);
    const { score, reason } = scoreVisitTourStop(company, context, {
      distanceKm: legDistanceKm,
      routeDeviationKm: deviationKm,
      detourKm,
    });

    const value = score - legDistanceKm * 1.5 - detourKm * 2;
    if (value > bestValue) {
      bestValue = value;
      best = {
        company,
        score,
        reason,
        deviationKm,
        detourKm,
        legDistanceKm,
      };
    }
  }

  return best;
}

function buildStop(
  pick: PickBestResult,
  order: number,
  locked: boolean
): VisitTourOptimizeStop {
  return {
    id: pick.company.id,
    order,
    locked,
    score: pick.score,
    reason: pick.reason,
    deviationKm: pick.deviationKm,
    legDistanceKm: pick.legDistanceKm,
    detourKm: pick.detourKm,
    company: pick.company,
  };
}

function refreshStopMetrics(
  stop: VisitTourOptimizeStop,
  from: GeoPoint,
  segmentEnd: GeoPoint,
  baseRoute: GeoPoint[],
  context: VisitTourOptimizeContext
): VisitTourOptimizeStop {
  const point = toPoint(stop.company);
  const legDistanceKm = getDistanceKm(from.lat, from.lng, point.lat, point.lng);
  const deviationKm = minDistanceToRouteKm(point, baseRoute);
  const detourKm = calcDetourKm(from, stop.company, segmentEnd);
  const { score, reason } = scoreVisitTourStop(stop.company, context, {
    distanceKm: legDistanceKm,
    routeDeviationKm: deviationKm,
    detourKm,
  });

  return {
    ...stop,
    score,
    reason,
    deviationKm,
    legDistanceKm,
    detourKm,
  };
}

export function optimizeVisitTour(input: OptimizeVisitTourInput): VisitTourOptimizePlan {
  const {
    origin,
    destination,
    companies,
    context,
    constraints,
    existingStops = [],
    originCompanyId,
    destinationCompanyId,
  } = input;

  const visitedToday = new Set(context.visitedTodayCompanyIds);
  const eligible = companies.filter(
    (company) =>
      isVisitTourEligible(company, visitedToday) &&
      company.id !== originCompanyId &&
      company.id !== destinationCompanyId
  );

  const baseRoute: GeoPoint[] = [origin, destination];
  const usedIds = new Set<string>();
  const slots: Array<VisitTourOptimizeStop | null> = Array.from(
    { length: constraints.maxStops },
    () => null
  );

  const orderedExisting = [...existingStops].sort((left, right) => left.order - right.order);
  for (const stop of orderedExisting) {
    const index = stop.order - 1;
    if (index < 0 || index >= slots.length) {
      continue;
    }

    if (stop.locked) {
      slots[index] = { ...stop, locked: true };
      usedIds.add(stop.id);
    }
  }

  const result: VisitTourOptimizeStop[] = [];
  let current = origin;
  let totalDistanceKm = 0;
  let totalDeviationKm = 0;
  let totalMinutes = 0;

  for (let index = 0; index < slots.length; index += 1) {
    let segmentEnd = destination;
    for (let ahead = index + 1; ahead < slots.length; ahead += 1) {
      const lockedAhead = slots[ahead];
      if (lockedAhead?.locked) {
        segmentEnd = toPoint(lockedAhead.company);
        break;
      }
    }

    let stop = slots[index];

    if (stop?.locked) {
      stop = refreshStopMetrics(stop, current, segmentEnd, baseRoute, context);
    } else {
      const pick = pickBestStop(
        current,
        segmentEnd,
        baseRoute,
        eligible,
        usedIds,
        context,
        constraints
      );

      if (!pick) {
        continue;
      }

      stop = buildStop(pick, index + 1, false);
      usedIds.add(stop.id);
    }

    const legMinutes = travelMinutes(stop.legDistanceKm);
    const nextMinutes = totalMinutes + legMinutes + VISIT_TOUR_STOP_MINUTES;
    const finalLegKm = getDistanceKm(
      stop.company.latitude,
      stop.company.longitude,
      destination.lat,
      destination.lng
    );
    const projectedTotal = nextMinutes + travelMinutes(finalLegKm);

    if (projectedTotal > constraints.maxDurationMinutes) {
      continue;
    }

    totalMinutes = nextMinutes;
    totalDistanceKm += stop.legDistanceKm;
    totalDeviationKm += stop.deviationKm;
    result.push({ ...stop, order: result.length + 1 });
    current = toPoint(stop.company);
  }

  const finalLegKm = getDistanceKm(current.lat, current.lng, destination.lat, destination.lng);
  totalDistanceKm += finalLegKm;
  totalMinutes += travelMinutes(finalLegKm);

  return {
    stops: result,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    estimatedMinutes: Math.round(totalMinutes),
    totalDeviationKm: Math.round(totalDeviationKm * 10) / 10,
  };
}

/** Ricalcola metriche per un ordine tappe già definito (drag/reorder manuale). */
export function recalculateVisitTourPlanMetrics(
  origin: GeoPoint,
  destination: GeoPoint,
  stops: VisitTourOptimizeStop[],
  context: VisitTourOptimizeContext
): VisitTourOptimizePlan {
  if (stops.length === 0) {
    return {
      stops: [],
      totalDistanceKm: 0,
      estimatedMinutes: 0,
      totalDeviationKm: 0,
    };
  }

  const baseRoute: GeoPoint[] = [origin, destination];
  let current = origin;
  let totalDistanceKm = 0;
  let totalDeviationKm = 0;
  let totalMinutes = 0;
  const refreshedStops: VisitTourOptimizeStop[] = [];

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]!;
    const segmentEnd =
      index === stops.length - 1 ? destination : toPoint(stops[index + 1]!.company);
    const refreshed = refreshStopMetrics(stop, current, segmentEnd, baseRoute, context);
    const legMinutes = travelMinutes(refreshed.legDistanceKm);
    totalMinutes += legMinutes + VISIT_TOUR_STOP_MINUTES;
    totalDistanceKm += refreshed.legDistanceKm;
    totalDeviationKm += refreshed.deviationKm;
    refreshedStops.push({ ...refreshed, order: index + 1 });
    current = toPoint(refreshed.company);
  }

  const finalLegKm = getDistanceKm(current.lat, current.lng, destination.lat, destination.lng);
  totalDistanceKm += finalLegKm;
  totalMinutes += travelMinutes(finalLegKm);

  return {
    stops: refreshedStops,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    estimatedMinutes: Math.round(totalMinutes),
    totalDeviationKm: Math.round(totalDeviationKm * 10) / 10,
  };
}

export function createManualStop(
  company: OptimizeVisitTourInput["companies"][number],
  order: number,
  origin: GeoPoint,
  destination: GeoPoint,
  context: VisitTourOptimizeContext
): VisitTourOptimizeStop {
  const baseRoute = [origin, destination];
  const point = toPoint(company);
  const legDistanceKm = getDistanceKm(origin.lat, origin.lng, point.lat, point.lng);
  const deviationKm = minDistanceToRouteKm(point, baseRoute);
  const detourKm = calcDetourKm(origin, company, destination);
  const { score, reason } = scoreVisitTourStop(company, context, {
    distanceKm: legDistanceKm,
    routeDeviationKm: deviationKm,
    detourKm,
  });

  return {
    id: company.id,
    order,
    locked: false,
    score,
    reason,
    deviationKm,
    legDistanceKm,
    detourKm,
    company,
  };
}
