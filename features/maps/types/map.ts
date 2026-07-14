import type { CommercialStatus, GeocodeStatus } from "@/lib/supabase/types";
import type { NearbyRadiusKm } from "../constants/map-config";
import { NEARBY_COMMERCIAL_STATUS_FILTERS } from "../constants/map-config";

export interface MapCompany {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  commercial_status: CommercialStatus;
  geocode_status: GeocodeStatus;
  latitude: number;
  longitude: number;
}

export interface MapViewportState {
  lat: number;
  lng: number;
  zoom: number;
}

export interface MapFiltersState {
  commercialStatus: CommercialStatus | "";
  province: string;
  city: string;
  geolocatedOnly: boolean;
}

export const DEFAULT_MAP_FILTERS: MapFiltersState = {
  commercialStatus: "",
  province: "",
  city: "",
  geolocatedOnly: true,
};

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface NearbyFiltersState {
  radiusKm: NearbyRadiusKm;
  commercialStatuses: NearbyCommercialStatusFilter[];
  province: string;
  city: string;
}

export type NearbyCommercialStatusFilter = (typeof NEARBY_COMMERCIAL_STATUS_FILTERS)[number];

export interface NearbyCompanyResult extends MapCompany {
  distanceKm: number;
}

export const DEFAULT_NEARBY_FILTERS: NearbyFiltersState = {
  radiusKm: 5,
  commercialStatuses: [...NEARBY_COMMERCIAL_STATUS_FILTERS],
  province: "",
  city: "",
};
