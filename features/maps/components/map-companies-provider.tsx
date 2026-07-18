"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMapCompaniesInBoundsAction,
} from "../actions/map-actions";
import {
  MAP_BOUNDS_DEBOUNCE_MS,
  MAP_INITIAL_RADIUS_KM,
  MAP_MAX_FETCH_PER_BOUNDS,
} from "../constants/map-config";
import type { MapCompaniesStats, MapCompany, MapFiltersState, MapGeoBounds } from "../types/map";
import {
  boundsFromCenter,
  boundsRequestKey,
  canSubdivideBounds,
  expandBounds,
  subdivideBounds,
} from "../utils/map-bounds";
import { unionMapCompanyBrandCaches } from "../utils/map-company-brands-aggregate";
import { sortMapCompanyBrands } from "../utils/map-brand-markers";

interface MapCompaniesContextValue {
  companies: MapCompany[];
  isLoading: boolean;
  error: string | null;
  loadedCount: number;
  stats: MapCompaniesStats;
  loadForBounds: (
    bounds: MapGeoBounds,
    filters: MapFiltersState,
    immediate?: boolean
  ) => Promise<MapCompany[]>;
  loadForCenter: (
    center: { lat: number; lng: number },
    filters: MapFiltersState,
    radiusKm?: number,
    immediate?: boolean
  ) => Promise<MapCompany[]>;
  clearCache: () => void;
}

const MapCompaniesContext = createContext<MapCompaniesContextValue | null>(null);

async function fetchAllPagesForBounds(
  bounds: MapGeoBounds,
  filters: MapFiltersState,
  onPage: (companies: MapCompany[]) => void,
  depth = 0
): Promise<{ companies: MapCompany[]; error: string | null }> {
  const byId = new Map<string, MapCompany>();
  let offset = 0;
  let hasMore = true;

  const upsert = (company: MapCompany) => {
    const existing = byId.get(company.id);
    if (!existing) {
      byId.set(company.id, company);
      return;
    }
    byId.set(company.id, {
      ...company,
      brands: sortMapCompanyBrands(
        unionMapCompanyBrandCaches(existing.brands, company.brands)
      ),
    });
  };

  while (offset < MAP_MAX_FETCH_PER_BOUNDS && hasMore) {
    let page: Awaited<ReturnType<typeof fetchMapCompaniesInBoundsAction>>;
    try {
      page = await fetchMapCompaniesInBoundsAction(bounds, filters, offset);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Errore caricamento mappa";
      return { companies: Array.from(byId.values()), error: message };
    }

    if (page.error) {
      return { companies: Array.from(byId.values()), error: page.error };
    }

    for (const company of page.data) {
      upsert(company);
    }

    // Merge progressivo: i marker appaiono già dalla prima pagina.
    if (page.data.length > 0) {
      onPage(page.data);
    }

    offset += page.loadedCount;
    hasMore = page.hasMore;
  }

  if (hasMore && canSubdivideBounds(bounds, depth)) {
    for (const quadrant of subdivideBounds(bounds)) {
      const subResult = await fetchAllPagesForBounds(
        quadrant,
        filters,
        onPage,
        depth + 1
      );
      if (subResult.error) {
        return { companies: Array.from(byId.values()), error: subResult.error };
      }

      for (const company of subResult.companies) {
        upsert(company);
      }
    }
  }

  return { companies: Array.from(byId.values()), error: null };
}

interface MapCompaniesProviderProps {
  stats: MapCompaniesStats;
  children: ReactNode;
}

function sortMapCompanies(companies: Iterable<MapCompany>): MapCompany[] {
  return Array.from(companies).sort((left, right) => left.name.localeCompare(right.name, "it"));
}

export function MapCompaniesProvider({ stats, children }: MapCompaniesProviderProps) {
  const cacheRef = useRef<Map<string, MapCompany>>(new Map());
  const [companies, setCompanies] = useState<MapCompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightPromisesRef = useRef<Map<string, Promise<MapCompany[]>>>(new Map());
  const lastCompletedKeyRef = useRef<string | null>(null);

  const mergeCompanies = useCallback((incoming: MapCompany[]) => {
    if (incoming.length === 0) {
      return;
    }

    let changed = false;
    for (const company of incoming) {
      const existing = cacheRef.current.get(company.id);
      // Unione Brand: mai sostituire un payload più ricco con uno più povero
      // (es. twin merge completo → fetch successivo senza twin in pagina).
      const mergedBrands = sortMapCompanyBrands(
        unionMapCompanyBrandCaches(existing?.brands, company.brands)
      );
      const brandsChanged =
        JSON.stringify(existing?.brands ?? []) !== JSON.stringify(mergedBrands);
      if (
        !existing ||
        existing.name !== company.name ||
        existing.commercial_status !== company.commercial_status ||
        brandsChanged ||
        existing.latitude !== company.latitude ||
        existing.longitude !== company.longitude
      ) {
        cacheRef.current.set(company.id, {
          ...company,
          brands: mergedBrands,
        });
        changed = true;
      }
    }

    if (changed) {
      setCompanies(sortMapCompanies(cacheRef.current.values()));
    }
  }, []);

  const clearCache = useCallback(() => {
    if (cacheRef.current.size === 0) {
      return;
    }

    cacheRef.current.clear();
    setCompanies([]);
    lastCompletedKeyRef.current = null;
  }, []);

  const runBoundsFetch = useCallback(
    async (bounds: MapGeoBounds, filters: MapFiltersState): Promise<MapCompany[]> => {
      const key = boundsRequestKey(bounds, filters);
      if (key === lastCompletedKeyRef.current && cacheRef.current.size > 0) {
        return Array.from(cacheRef.current.values());
      }

      const inFlight = inFlightPromisesRef.current.get(key);
      if (inFlight) {
        return inFlight;
      }

      const promise = (async () => {
        setIsLoading(true);
        setError(null);

        try {
          const result = await fetchAllPagesForBounds(bounds, filters, mergeCompanies);
          if (result.error) {
            setError(result.error);
          }
          mergeCompanies(result.companies);
          if (!result.error || result.companies.length > 0) {
            lastCompletedKeyRef.current = key;
          }
          return result.companies;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Errore caricamento mappa";
          setError(message);
          return Array.from(cacheRef.current.values());
        } finally {
          inFlightPromisesRef.current.delete(key);
          setIsLoading(false);
        }
      })();

      inFlightPromisesRef.current.set(key, promise);
      return promise;
    },
    [mergeCompanies]
  );

  const loadForBounds = useCallback(
    (
      bounds: MapGeoBounds,
      filters: MapFiltersState,
      immediate = false
    ): Promise<MapCompany[]> => {
      const expanded = expandBounds(bounds);

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        return runBoundsFetch(expanded, filters);
      }

      return new Promise((resolve) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          void runBoundsFetch(expanded, filters).then(resolve);
        }, MAP_BOUNDS_DEBOUNCE_MS);
      });
    },
    [runBoundsFetch]
  );

  const loadForCenter = useCallback(
    (
      center: { lat: number; lng: number },
      filters: MapFiltersState,
      radiusKm = MAP_INITIAL_RADIUS_KM,
      immediate = true
    ) => {
      return loadForBounds(boundsFromCenter(center, radiusKm), filters, immediate);
    },
    [loadForBounds]
  );

  const runtimeStats = useMemo(
    (): MapCompaniesStats => ({
      ...stats,
      loadedCount: companies.length,
      isTruncated: companies.length < stats.totalWithCoordinates,
    }),
    [companies.length, stats]
  );

  const value = useMemo(
    () => ({
      companies,
      isLoading,
      error,
      loadedCount: companies.length,
      stats: runtimeStats,
      loadForBounds,
      loadForCenter,
      clearCache,
    }),
    [clearCache, companies, error, isLoading, loadForBounds, loadForCenter, runtimeStats]
  );

  return <MapCompaniesContext.Provider value={value}>{children}</MapCompaniesContext.Provider>;
}

export function useMapCompanies(): MapCompaniesContextValue {
  const context = useContext(MapCompaniesContext);
  if (!context) {
    throw new Error("useMapCompanies must be used within MapCompaniesProvider");
  }
  return context;
}
