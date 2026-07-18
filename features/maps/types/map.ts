import type {
  BrandRelationshipStatus,
  CommercialStatus,
  GeocodeStatus,
} from "@/lib/supabase/types";
import type { NearbyRadiusKm } from "../constants/map-config";
import { NEARBY_COMMERCIAL_STATUS_FILTERS } from "../constants/map-config";

export interface MapCompaniesStats {
  /** Aziende con coordinate nel database (qualsiasi stato geocoding). */
  totalWithCoordinates: number;
  /** Aziende geocoded/completed con coordinate (allineato alla pagina Aziende). */
  totalGeocodedConfirmed: number;
  /** Righe effettivamente caricate dal server. */
  loadedCount: number;
  /** true se il caricamento non ha recuperato tutte le aziende con coordinate. */
  isTruncated: boolean;
}

/** Marchio associato a un'azienda per marker/popup mappa. */
export interface MapCompanyBrand {
  brand_id: string;
  name: string;
  slug: string;
  color: string | null;
  is_primary: boolean;
  relationship_status: BrandRelationshipStatus;
  /** Presente solo se la colonna esiste sul DB live. */
  customer_code?: string | null;
}

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
  /** Brand da company_brands (primary → alfabetico). Opzionale per compatibilità moduli non-mappa. */
  brands?: MapCompanyBrand[];
}

export interface MapViewportState {
  lat: number;
  lng: number;
  zoom: number;
}

export interface MapGeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCompaniesFetchResult {
  data: MapCompany[];
  error: string | null;
  hasMore: boolean;
  loadedCount: number;
}

export interface MapPageBootstrap {
  stats: MapCompaniesStats;
  provinces: string[];
  error: string | null;
}

export interface MapFiltersState {
  commercialStatus: CommercialStatus | "";
  /** Slug brands.slug selezionati (vuoto = tutti). */
  brandSlugs: string[];
  brandMatchMode: "or" | "and";
  province: string;
  city: string;
  geolocatedOnly: boolean;
}

export const DEFAULT_MAP_FILTERS: MapFiltersState = {
  commercialStatus: "",
  brandSlugs: [],
  brandMatchMode: "or",
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
