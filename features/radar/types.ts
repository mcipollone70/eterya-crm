import type { CommercialStatus, GeocodeStatus } from "@/lib/supabase/types";
import type { PriorityTier } from "@/lib/commercial-priority/types";
import type { NearbyRadiusKm } from "@/features/maps/constants/map-config";

export interface RadarCompanySource {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  commercial_status: CommercialStatus;
  geocode_status?: GeocodeStatus;
}

export interface OpportunityRadarItem {
  companyId: string;
  companyName: string;
  city: string | null;
  province: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  commercialStatus: CommercialStatus;
  distanceKm: number;
  score: number;
  tier: PriorityTier;
  priorityScore: number;
  opportunityValue: number;
  lastVisitLabel: string;
  primaryReason: string;
  reasons: string[];
}

export interface OpportunityRadarAnalyzeInput {
  centerLat: number;
  centerLng: number;
  radiusKm: NearbyRadiusKm;
  companyIds: string[];
}

export interface OpportunityRadarAnalyzeResult {
  items: OpportunityRadarItem[];
  error: string | null;
}

export const RADAR_COMMERCIAL_STATUSES: CommercialStatus[] = ["prospect", "cliente"];
