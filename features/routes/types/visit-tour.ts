import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";
import type { PriorityTier } from "@/lib/commercial-priority/types";

export type VisitTourDestinationType = "company" | "address";

export type VisitTourSortKey = "distance" | "priority" | "lastVisit" | "potential";

export type RouteDistanceBand = "500m" | "1km" | "2km";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface VisitTourCompany {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  commercial_status: CommercialStatus;
  status: CompanyStatus;
  latitude: number;
  longitude: number;
  revenue: number | null;
  lastVisitAt: string | null;
  import_payload: Json | null;
}

export interface VisitTourCandidate extends VisitTourCompany {
  distanceFromRouteKm: number;
  distanceBand: RouteDistanceBand;
  priorityScore: number;
  priorityTier: PriorityTier;
  potentialScore: number;
}

export interface VisitTourRoute {
  coordinates: GeoPoint[];
  distanceKm: number;
}

export interface VisitTourDestination {
  type: VisitTourDestinationType;
  label: string;
  point: GeoPoint;
  companyId?: string;
}

export const ROUTE_CORRIDOR_KM = 2;
export const ROUTE_BAND_LIMITS_KM = {
  "500m": 0.5,
  "1km": 1,
  "2km": 2,
} as const;

export type VisitTourPlannerMode = "corridor" | "optimize";

export type VisitTourSaveStatus = "draft" | "planned" | "completed" | "cancelled";

export type {
  VisitTourConstraints,
  VisitTourOptimizePlan,
  VisitTourOptimizeStop,
} from "@/lib/visit-tour/optimize";

export type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";

export {
  VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
  VISIT_TOUR_DEFAULT_MAX_STOPS,
} from "@/lib/visit-tour/constants";
