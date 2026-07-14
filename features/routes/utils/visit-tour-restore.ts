import type {
  GeoPoint,
  VisitTourCompany,
  VisitTourConstraints,
  VisitTourDestination,
  VisitTourDestinationType,
  VisitTourLoadedState,
  VisitTourOptimizePlan,
  VisitTourOptimizeStop,
  VisitTourStoredPoint,
  VisitTourStoredStop,
} from "../types/visit-tour";
import {
  VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
  VISIT_TOUR_DEFAULT_MAX_STOPS,
} from "@/lib/visit-tour/constants";

function parseStoredPoint(value: unknown): VisitTourStoredPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const label = String(row.label ?? "").trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) {
    return null;
  }

  return {
    lat,
    lng,
    label,
    companyId: row.companyId ? String(row.companyId) : undefined,
  };
}

function parseStoredStops(value: unknown): VisitTourStoredStop[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Record<string, unknown>;
      const id = String(row.id ?? row.companyId ?? "");
      const companyId = String(row.companyId ?? row.id ?? "");

      if (!id || !companyId) {
        return null;
      }

      return {
        id,
        order: Number(row.order ?? 0),
        locked: Boolean(row.locked),
        score: Number(row.score ?? 0),
        reason: String(row.reason ?? ""),
        deviationKm: Number(row.deviationKm ?? 0),
        legDistanceKm: Number(row.legDistanceKm ?? 0),
        detourKm: Number(row.detourKm ?? 0),
        companyId,
        companyName: String(row.companyName ?? ""),
      };
    })
    .filter((stop): stop is VisitTourStoredStop => stop !== null)
    .sort((left, right) => left.order - right.order);
}

function parseConstraints(value: unknown): VisitTourConstraints {
  if (!value || typeof value !== "object") {
    return {
      maxDurationMinutes: VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
      maxStops: VISIT_TOUR_DEFAULT_MAX_STOPS,
      maxDeviationKm: VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
    };
  }

  const row = value as Record<string, unknown>;
  return {
    maxDurationMinutes:
      Number(row.maxDurationMinutes) || VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
    maxStops: Number(row.maxStops) || VISIT_TOUR_DEFAULT_MAX_STOPS,
    maxDeviationKm: Number(row.maxDeviationKm) || VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  };
}

export function buildDefaultTourName(tourDate: string, stopCount: number): string {
  const formatted = tourDate.includes("-")
    ? tourDate.split("-").reverse().join("/")
    : tourDate;
  return `Giro ${formatted} · ${stopCount} tappe`;
}

export function restoreVisitTourStops(
  storedStops: VisitTourStoredStop[],
  companies: VisitTourCompany[]
): VisitTourOptimizeStop[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const restored: VisitTourOptimizeStop[] = [];

  for (const stored of storedStops) {
    const company = companyById.get(stored.companyId);
    if (!company) {
      continue;
    }

    restored.push({
      id: stored.id,
      order: stored.order,
      locked: stored.locked,
      score: stored.score,
      reason: stored.reason,
      deviationKm: stored.deviationKm,
      legDistanceKm: stored.legDistanceKm,
      detourKm: stored.detourKm,
      company: {
        id: company.id,
        name: company.name,
        city: company.city ?? null,
        province: company.province ?? null,
        phone: company.phone ?? null,
        commercial_status: company.commercial_status,
        status: company.status,
        latitude: company.latitude,
        longitude: company.longitude,
        revenue: company.revenue ?? null,
        lastVisitAt: company.lastVisitAt,
        import_payload: company.import_payload,
      },
    });
  }

  return restored;
}

function resolveOriginType(origin: VisitTourStoredPoint): "current" | VisitTourDestinationType {
  if (origin.companyId) {
    return "company";
  }

  if (origin.label === "Posizione corrente") {
    return "current";
  }

  return "address";
}

function resolveDestinationType(
  destination: VisitTourStoredPoint
): VisitTourDestinationType {
  return destination.companyId ? "company" : "address";
}

export function buildVisitTourLoadedState(input: {
  id: string;
  name: string;
  tourDate: string;
  notes: string | null;
  origin: unknown;
  destination: unknown;
  constraints: unknown;
  stops: unknown;
  totalDistanceKm: number | null;
  estimatedMinutes: number | null;
  deviationKm: number | null;
  companies: VisitTourCompany[];
}): VisitTourLoadedState | null {
  const origin = parseStoredPoint(input.origin);
  const destination = parseStoredPoint(input.destination);

  if (!origin || !destination) {
    return null;
  }

  const storedStops = parseStoredStops(input.stops);
  const stops = restoreVisitTourStops(storedStops, input.companies);

  if (stops.length === 0) {
    return null;
  }

  const constraints = parseConstraints(input.constraints);
  const originType = resolveOriginType(origin);
  const destinationType = resolveDestinationType(destination);

  const plan: VisitTourOptimizePlan = {
    stops,
    totalDistanceKm: Number(input.totalDistanceKm ?? 0),
    estimatedMinutes: Number(input.estimatedMinutes ?? 0),
    totalDeviationKm: Number(input.deviationKm ?? 0),
  };

  const destinationState: VisitTourDestination = {
    type: destinationType,
    label: destination.label,
    point: { lat: destination.lat, lng: destination.lng },
    companyId: destination.companyId,
  };

  return {
    id: input.id,
    name: input.name,
    tourDate: input.tourDate,
    notes: input.notes,
    originType,
    originCompanyId: origin.companyId ?? "",
    originLabel: origin.label,
    origin: { lat: origin.lat, lng: origin.lng },
    destinationType,
    destinationCompanyId: destination.companyId ?? "",
    destination: destinationState,
    constraints,
    stops,
    plan,
  };
}

export function buildVisitTourWaypointPoints(
  loadedTour: VisitTourLoadedState,
  companies: VisitTourCompany[]
): GeoPoint[] {
  const companyById = new Map(companies.map((company) => [company.id, company]));

  return loadedTour.stops
    .map((stop) => {
      const company = companyById.get(stop.id);
      if (!company) {
        return null;
      }

      return { lat: company.latitude, lng: company.longitude };
    })
    .filter((point): point is GeoPoint => point !== null);
}
