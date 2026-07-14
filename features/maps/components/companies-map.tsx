"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { PageHeader } from "@/components/ui";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_VIEWPORT_STORAGE_KEY,
} from "../constants/map-config";
import type { MapCompany, MapFiltersState, MapViewportState, UserLocation } from "../types/map";
import { DEFAULT_MAP_FILTERS } from "../types/map";
import { filterMapCompanies } from "../utils/map-filters";
import { MapSidebarFilters } from "./map-sidebar-filters";
import { MarkerClusterLayer } from "./marker-cluster-layer";
import { NearbyCompaniesPanel } from "./nearby-companies-panel";

interface CompaniesMapProps {
  companies: MapCompany[];
  provinces: string[];
}

function readStoredViewport(): MapViewportState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MAP_VIEWPORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as MapViewportState;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      typeof parsed.zoom === "number"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function MapViewportPersistence() {
  const map = useMap();

  useEffect(() => {
    function persistViewport() {
      const center = map.getCenter();
      const payload: MapViewportState = {
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
      };
      window.localStorage.setItem(MAP_VIEWPORT_STORAGE_KEY, JSON.stringify(payload));
    }

    map.on("moveend", persistViewport);
    map.on("zoomend", persistViewport);

    return () => {
      map.off("moveend", persistViewport);
      map.off("zoomend", persistViewport);
    };
  }, [map]);

  return null;
}

function MapLocateController({
  locateSignal,
  onLocationFound,
  onLocationError,
}: {
  locateSignal: number;
  onLocationFound: (location: UserLocation) => void;
  onLocationError: (message: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (locateSignal === 0) {
      return;
    }

    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });

    const handleLocationFound = (event: L.LocationEvent) => {
      map.setView(event.latlng, Math.max(map.getZoom(), 14));
      onLocationFound({ lat: event.latlng.lat, lng: event.latlng.lng });
    };

    const handleLocationError = () => {
      onLocationError("Impossibile ottenere la posizione corrente.");
    };

    map.on("locationfound", handleLocationFound);
    map.on("locationerror", handleLocationError);

    return () => {
      map.off("locationfound", handleLocationFound);
      map.off("locationerror", handleLocationError);
    };
  }, [locateSignal, map, onLocationError, onLocationFound]);

  return null;
}

function requestBrowserLocation(
  onSuccess: (location: UserLocation) => void,
  onError: (message: string) => void
): void {
  if (!navigator.geolocation) {
    onError("Geolocalizzazione non supportata dal browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    () => {
      onError("Permesso di geolocalizzazione negato o non disponibile.");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

export function CompaniesMap({ companies, provinces }: CompaniesMapProps) {
  const [filters, setFilters] = useState<MapFiltersState>(DEFAULT_MAP_FILTERS);
  const [locateSignal, setLocateSignal] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [initialViewport] = useState<MapViewportState>(() => {
    return readStoredViewport() ?? {
      lat: DEFAULT_MAP_CENTER[0],
      lng: DEFAULT_MAP_CENTER[1],
      zoom: DEFAULT_MAP_ZOOM,
    };
  });

  const filteredCompanies = useMemo(
    () => filterMapCompanies(companies, filters),
    [companies, filters]
  );

  const handleLocationFound = useCallback((location: UserLocation) => {
    setUserLocation(location);
    setLocationError(null);
    setIsLocating(false);
  }, []);

  const handleLocationError = useCallback((message: string) => {
    setLocationError(message);
    setIsLocating(false);
  }, []);

  const handleGoToMyLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);
    setLocateSignal((value) => value + 1);
  }, []);

  const handleRequestNearbyLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);
    requestBrowserLocation(handleLocationFound, handleLocationError);
  }, [handleLocationError, handleLocationFound]);

  useEffect(() => {
    requestBrowserLocation(handleLocationFound, () => undefined);
  }, [handleLocationFound]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mappa"
        subtitle={`${filteredCompanies.length.toLocaleString("it-IT")} aziende geolocalizzate visualizzate su ${companies.length.toLocaleString("it-IT")} totali.`}
      />

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-12rem)] lg:flex-row">
        <div className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0 lg:overflow-y-auto">
          <MapSidebarFilters
            companies={companies}
            provinces={provinces}
            filters={filters}
            visibleCount={filteredCompanies.length}
            onChange={setFilters}
            onGoToMyLocation={handleGoToMyLocation}
          />
          <NearbyCompaniesPanel
            companies={companies}
            provinces={provinces}
            userLocation={userLocation}
            isLocating={isLocating}
            locationError={locationError}
            onRequestLocation={handleRequestNearbyLocation}
          />
        </div>

        <div className="min-h-[480px] flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm lg:min-h-0">
          <MapContainer
            center={[initialViewport.lat, initialViewport.lng]}
            zoom={initialViewport.zoom}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewportPersistence />
            <MapLocateController
              locateSignal={locateSignal}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
            />
            <MarkerClusterLayer companies={filteredCompanies} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
