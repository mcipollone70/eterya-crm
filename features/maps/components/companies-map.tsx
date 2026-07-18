"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  FALLBACK_MAP_CENTER,
  MAP_VIEWPORT_STORAGE_KEY,
} from "../constants/map-config";
import type { MapFiltersState, MapViewportState, UserLocation } from "../types/map";
import { DEFAULT_MAP_FILTERS } from "../types/map";
import { filterMapCompanies, formatMapPageSubtitle } from "../utils/map-filters";
import { boundsRequestKey, filtersKey } from "../utils/map-bounds";
import { MapBrandLegend } from "./map-brand-legend";
import { MapSidebarFilters } from "./map-sidebar-filters";
import { MarkerClusterLayer } from "./marker-cluster-layer";
import { OpportunityRadarPanel } from "@/features/radar/components/opportunity-radar-panel";
import type { RadarCompanySource } from "@/features/radar/types";
import { useMapCompanies } from "./map-companies-provider";
import {
  parseBrandMatchMode,
  parseBrandsUrlParam,
  serializeBrandsUrlParam,
} from "@/features/brands/utils/brand-shared";
import { isCommercialStatus } from "@/lib/constants/commercial-status";

interface CompaniesMapProps {
  provinces: string[];
  brands: Array<{ id: string; name: string; slug: string; color: string | null }>;
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

const MAP_DIAG =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function logMapDiag(message: string, payload?: Record<string, unknown>) {
  if (!MAP_DIAG) return;
  if (payload) {
    console.info(`[map/mobile] ${message}`, payload);
  } else {
    console.info(`[map/mobile] ${message}`);
  }
}

function MapSizeInvalidator({
  containerRef,
  layoutKey,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  /** Cambia quando tab/filtri/layout mobile cambiano — forza invalidateSize. */
  layoutKey?: string | number;
}) {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    const timeouts: number[] = [];

    const measure = () => {
      const el = containerRef.current ?? (map.getContainer() as HTMLElement | null);
      if (!el) {
        return { w: 0, h: 0 };
      }
      const rect = el.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    };

    const refresh = (reason: string) => {
      if (cancelled) return;
      const size = measure();
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // ignore
      }
      logMapDiag(`invalidateSize (${reason})`, {
        containerWidth: size.w,
        containerHeight: size.h,
        mapSize: map.getSize(),
        zoom: map.getZoom(),
        center: map.getCenter(),
        tilePaneChildren:
          map.getPane("tilePane")?.querySelectorAll("img").length ?? 0,
        standalone:
          typeof window !== "undefined" &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            ("standalone" in navigator &&
              Boolean((navigator as Navigator & { standalone?: boolean }).standalone))),
      });
    };

    map.whenReady(() => refresh("whenReady"));
    timeouts.push(window.setTimeout(() => refresh("mount+50ms"), 50));
    timeouts.push(window.setTimeout(() => refresh("mount+300ms"), 300));
    timeouts.push(window.setTimeout(() => refresh("layoutKey"), 100));

    const onResize = () => refresh("resize");
    const onOrientation = () => refresh("orientationchange");
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh("visibilitychange");
      }
    };
    const onPageShow = () => refresh("pageshow");

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    const el = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => refresh("ResizeObserver"));
      observer.observe(el);
    }

    map.on("tileerror", () => {
      logMapDiag("tileerror", { note: "OSM tile failed to load" });
    });

    return () => {
      cancelled = true;
      for (const id of timeouts) window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      observer?.disconnect();
      map.off("tileerror");
    };
  }, [containerRef, layoutKey, map]);

  return null;
}

function MapViewportLoader({ filters }: { filters: MapFiltersState }) {
  const map = useMap();
  const { loadForBounds } = useMapCompanies();
  const filterKey = filtersKey(filters);
  const lastRequestKeyRef = useRef<string>("");

  useEffect(() => {
    lastRequestKeyRef.current = "";
    const report = () => {
      const leafletBounds = map.getBounds();
      const bounds = {
        north: leafletBounds.getNorth(),
        south: leafletBounds.getSouth(),
        east: leafletBounds.getEast(),
        west: leafletBounds.getWest(),
      };
      const requestKey = boundsRequestKey(bounds, filters);
      if (requestKey === lastRequestKeyRef.current) {
        return;
      }
      lastRequestKeyRef.current = requestKey;
      void loadForBounds(bounds, filters);
    };

    map.whenReady(report);
    map.on("moveend", report);
    map.on("zoomend", report);

    return () => {
      map.off("moveend", report);
      map.off("zoomend", report);
    };
    // filterKey stabilizza: evita refetch se solo l'identità oggetto filters cambia.
  }, [filterKey, filters, loadForBounds, map]);

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

export function CompaniesMap({ provinces, brands }: CompaniesMapProps) {
  const { companies, stats, loadForCenter, clearCache } = useMapCompanies();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<MapFiltersState>(() => {
    const brandSlugs = parseBrandsUrlParam(searchParams.get("brands"));
    const brandMatchMode = parseBrandMatchMode(searchParams.get("brand_mode"));
    const commercialRaw = searchParams.get("commercial_status") ?? "";
    const commercialStatus =
      commercialRaw && isCommercialStatus(commercialRaw) ? commercialRaw : "";
    return {
      ...DEFAULT_MAP_FILTERS,
      brandSlugs,
      brandMatchMode,
      commercialStatus,
    };
  });
  const [locateSignal, setLocateSignal] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"map" | "list">("map");
  const [initialViewport] = useState<MapViewportState>(() => {
    return readStoredViewport() ?? {
      lat: DEFAULT_MAP_CENTER[0],
      lng: DEFAULT_MAP_CENTER[1],
      zoom: DEFAULT_MAP_ZOOM,
    };
  });

  const filterSignature = filtersKey(filters);
  const prevFilterSignatureRef = useRef(filterSignature);

  // Cambio filtri Brand/relazione/geo → reset cache e nuovo fetch (evita payload parziale).
  useEffect(() => {
    if (prevFilterSignatureRef.current === filterSignature) {
      return;
    }
    prevFilterSignatureRef.current = filterSignature;
    clearCache();
  }, [clearCache, filterSignature]);

  // Persistenza URL filtri Brand + relazione (solo se cambiano davvero)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const serialized = serializeBrandsUrlParam(filters.brandSlugs);
    if (serialized) {
      params.set("brands", serialized);
    } else {
      params.delete("brands");
    }
    if (filters.brandMatchMode === "and" && filters.brandSlugs.length > 1) {
      params.set("brand_mode", "and");
    } else {
      params.delete("brand_mode");
    }
    if (filters.commercialStatus) {
      params.set("commercial_status", filters.commercialStatus);
    } else {
      params.delete("commercial_status");
    }
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [filters.brandSlugs, filters.brandMatchMode, filters.commercialStatus, pathname, router, searchParams]);

  const filteredCompanies = useMemo(
    () => filterMapCompanies(companies, filters),
    [companies, filters]
  );

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const handleLocationFound = useCallback(
    (location: UserLocation) => {
      setUserLocation(location);
      setLocationError(null);
      setIsLocating(false);
      void loadForCenter(location, filtersRef.current, undefined, true);
    },
    [loadForCenter]
  );

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

  const mapShellRef = useRef<HTMLDivElement | null>(null);

  // Geolocalizzazione una sola volta al mount (non a ogni cambio filtri).
  // Non bloccante: le aziende arrivano comunque da MapViewportLoader / bounds.
  useEffect(() => {
    requestBrowserLocation(handleLocationFound, (message) => {
      logMapDiag("geolocation denied/unavailable (non-blocking)", { message });
      // Fallback area Latina: mappa e marker restano usabili senza GPS.
      void loadForCenter(
        { lat: FALLBACK_MAP_CENTER[0], lng: FALLBACK_MAP_CENTER[1] },
        filtersRef.current,
        undefined,
        true
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  useEffect(() => {
    if (mobileTab !== "map") {
      return;
    }
    const timeouts = [
      window.setTimeout(() => {
        const el = mapShellRef.current;
        if (!el) return;
        logMapDiag("mobile tab map visible", {
          clientWidth: el.clientWidth,
          clientHeight: el.clientHeight,
          rect: el.getBoundingClientRect().toJSON?.() ?? el.getBoundingClientRect(),
        });
      }, 80),
    ];
    return () => {
      for (const id of timeouts) window.clearTimeout(id);
    };
  }, [mobileTab]);

  useEffect(() => {
    logMapDiag("companies/markers update", {
      companiesReceived: companies.length,
      markersVisible: filteredCompanies.length,
    });
  }, [companies.length, filteredCompanies.length]);

  const subtitle = useMemo(
    () => formatMapPageSubtitle(filteredCompanies.length, stats, filters),
    [filteredCompanies.length, stats, filters]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Mappa" subtitle={subtitle} />

      {/* Mobile: tab Mappa/Lista — cartografia non resta sotto filtri lunghi. */}
      <div
        className="flex gap-2 lg:hidden"
        role="tablist"
        aria-label="Vista mappa"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "map"}
          onClick={() => setMobileTab("map")}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
            mobileTab === "map"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
          data-testid="map-tab-map"
        >
          Mappa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "list"}
          onClick={() => setMobileTab("list")}
          className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-medium ${
            mobileTab === "list"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
          data-testid="map-tab-list"
        >
          Filtri e elenco
        </button>
      </div>

      {/* Mobile: altezza esplicita (dvh − header − bottom nav − safe area). Desktop invariato. */}
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-0 lg:flex-row">
        <div
          className={`w-full flex-col gap-4 lg:flex lg:w-72 lg:shrink-0 lg:overflow-y-auto ${
            mobileTab === "list" ? "flex" : "hidden lg:flex"
          }`}
        >
          <MapSidebarFilters
            provinces={provinces}
            brands={brands}
            filters={filters}
            visibleCount={filteredCompanies.length}
            onChange={setFilters}
            onGoToMyLocation={handleGoToMyLocation}
          />
          <OpportunityRadarPanel
            companies={filteredCompanies as RadarCompanySource[]}
            center={userLocation}
            isLocating={isLocating}
            locationError={locationError}
            onRequestLocation={handleRequestNearbyLocation}
          />
        </div>

        <div
          ref={mapShellRef}
          className={`relative w-full flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm lg:block lg:h-auto lg:min-h-0 ${
            mobileTab === "map" ? "block" : "hidden lg:block"
          } h-[calc(100dvh-11.5rem-env(safe-area-inset-bottom,0px))] min-h-[280px] max-h-[calc(100dvh-9rem)]`}
          data-testid="companies-map-shell"
        >
          <MapContainer
            center={[initialViewport.lat, initialViewport.lng]}
            zoom={initialViewport.zoom}
            className="absolute inset-0 z-0 h-full w-full"
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              crossOrigin="anonymous"
            />
            <MapSizeInvalidator containerRef={mapShellRef} layoutKey={mobileTab} />
            <MapViewportPersistence />
            <MapViewportLoader filters={filters} />
            <MapLocateController
              locateSignal={locateSignal}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
            />
            <MarkerClusterLayer companies={filteredCompanies} />
          </MapContainer>
          <MapBrandLegend />
        </div>
      </div>
    </div>
  );
}
