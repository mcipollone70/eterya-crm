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
  depth = 0
): Promise<{ companies: MapCompany[]; error: string | null }> {
  const byId = new Map<string, MapCompany>();
  let offset = 0;
  let hasMore = true;

  while (offset < MAP_MAX_FETCH_PER_BOUNDS && hasMore) {
    const page = await fetchMapCompaniesInBoundsAction(bounds, filters, offset);
    if (page.error) {
      return { companies: Array.from(byId.values()), error: page.error };
    }

    for (const company of page.data) {
      byId.set(company.id, company);
    }

    offset += page.loadedCount;
    hasMore = page.hasMore;
  }

  if (hasMore && canSubdivideBounds(bounds, depth)) {
    for (const quadrant of subdivideBounds(bounds)) {
      const subResult = await fetchAllPagesForBounds(quadrant, filters, depth + 1);
      if (subResult.error) {
        return { companies: Array.from(byId.values()), error: subResult.error };
      }

      for (const company of subResult.companies) {
        byId.set(company.id, company);
      }
    }
  }

  return { companies: Array.from(byId.values()), error: null };
}

interface MapCompaniesProviderProps {
  stats: MapCompaniesStats;
  children: ReactNode;
}

export function MapCompaniesProvider({ stats, children }: MapCompaniesProviderProps) {
  const cacheRef = useRef<Map<string, MapCompany>>(new Map());
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightPromisesRef = useRef<Map<string, Promise<MapCompany[]>>>(new Map());

  const mergeCompanies = useCallback((incoming: MapCompany[]) => {
    if (incoming.length === 0) {
      return;
    }

    let changed = false;
    for (const company of incoming) {
      const existing = cacheRef.current.get(company.id);
      if (!existing || existing.name !== company.name) {
        cacheRef.current.set(company.id, company);
        changed = true;
      }
    }

    if (changed) {
      setVersion((current) => current + 1);
    }
  }, []);

  const clearCache = useCallback(() => {
    if (cacheRef.current.size === 0) {
      return;
    }

    cacheRef.current.clear();
    setVersion((current) => current + 1);
  }, []);

  const runBoundsFetch = useCallback(
    async (bounds: MapGeoBounds, filters: MapFiltersState): Promise<MapCompany[]> => {
      const key = boundsRequestKey(bounds, filters);
      const inFlight = inFlightPromisesRef.current.get(key);
      if (inFlight) {
        return inFlight;
      }

      const promise = (async () => {
        setIsLoading(true);
        setError(null);

        try {
          const result = await fetchAllPagesForBounds(bounds, filters);
          if (result.error) {
            setError(result.error);
          }
          mergeCompanies(result.companies);
          return result.companies;
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

  const companies = useMemo(() => {
    void version;
    return Array.from(cacheRef.current.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "it")
    );
  }, [version]);

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
