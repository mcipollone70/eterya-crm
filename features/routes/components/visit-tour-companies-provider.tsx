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
  fetchVisitTourCompaniesByIdsAction,
  fetchVisitTourCompaniesInBoundsAction,
  searchVisitTourCompaniesAction,
} from "../actions/visit-tour-actions";
import {
  VISIT_TOUR_BOUNDS_DEBOUNCE_MS,
  VISIT_TOUR_INITIAL_RADIUS_KM,
  VISIT_TOUR_MAX_FETCH_PER_BOUNDS,
} from "../constants/visit-tour-fetch";
import type { GeoPoint, VisitTourCompany, VisitTourGeoBounds } from "../types/visit-tour";
import {
  boundsFromCenter,
  boundsFromPoints,
  boundsKey,
  expandBounds,
} from "../utils/visit-tour-bounds";

interface VisitTourCompaniesContextValue {
  companies: VisitTourCompany[];
  companyById: Map<string, VisitTourCompany>;
  isLoading: boolean;
  error: string | null;
  loadedCount: number;
  loadForBounds: (
    bounds: VisitTourGeoBounds,
    immediate?: boolean
  ) => Promise<VisitTourCompany[]>;
  loadForCenter: (
    center: GeoPoint,
    radiusKm?: number,
    immediate?: boolean
  ) => Promise<VisitTourCompany[]>;
  loadForPoints: (
    points: GeoPoint[],
    bufferKm?: number,
    immediate?: boolean
  ) => Promise<VisitTourCompany[]>;
  loadByIds: (ids: string[]) => Promise<void>;
  searchCompanies: (query: string, bounds?: VisitTourGeoBounds | null) => Promise<VisitTourCompany[]>;
}

const VisitTourCompaniesContext = createContext<VisitTourCompaniesContextValue | null>(null);

async function fetchAllPagesForBounds(bounds: VisitTourGeoBounds): Promise<{
  companies: VisitTourCompany[];
  error: string | null;
}> {
  const companies: VisitTourCompany[] = [];
  let offset = 0;

  while (offset < VISIT_TOUR_MAX_FETCH_PER_BOUNDS) {
    const page = await fetchVisitTourCompaniesInBoundsAction(bounds, offset);
    if (page.error) {
      return { companies, error: page.error };
    }

    companies.push(...page.data);
    offset += page.loadedCount;

    if (!page.hasMore || page.loadedCount === 0) {
      break;
    }
  }

  return { companies, error: null };
}

export function VisitTourCompaniesProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, VisitTourCompany>>(new Map());
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightBoundsRef = useRef<Set<string>>(new Set());
  const inFlightPromisesRef = useRef<Map<string, Promise<VisitTourCompany[]>>>(new Map());

  const mergeCompanies = useCallback((incoming: VisitTourCompany[]) => {
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

  const runBoundsFetch = useCallback(
    async (bounds: VisitTourGeoBounds): Promise<VisitTourCompany[]> => {
      const key = boundsKey(bounds);
      const inFlight = inFlightPromisesRef.current.get(key);
      if (inFlight) {
        return inFlight;
      }

      const promise = (async () => {
        inFlightBoundsRef.current.add(key);
        setIsLoading(true);
        setError(null);

        try {
          const result = await fetchAllPagesForBounds(bounds);
          if (result.error) {
            setError(result.error);
          }
          mergeCompanies(result.companies);
          return result.companies;
        } finally {
          inFlightBoundsRef.current.delete(key);
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
    (bounds: VisitTourGeoBounds, immediate = false): Promise<VisitTourCompany[]> => {
      const expanded = expandBounds(bounds);

      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        return runBoundsFetch(expanded);
      }

      return new Promise((resolve) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          void runBoundsFetch(expanded).then(resolve);
        }, VISIT_TOUR_BOUNDS_DEBOUNCE_MS);
      });
    },
    [runBoundsFetch]
  );

  const loadForCenter = useCallback(
    (center: GeoPoint, radiusKm = VISIT_TOUR_INITIAL_RADIUS_KM, immediate = true) => {
      return loadForBounds(boundsFromCenter(center, radiusKm), immediate);
    },
    [loadForBounds]
  );

  const loadForPoints = useCallback(
    (points: GeoPoint[], bufferKm?: number, immediate = true) => {
      const bounds = boundsFromPoints(points, bufferKm ?? 4);
      if (!bounds) {
        return Promise.resolve([]);
      }
      return loadForBounds(bounds, immediate);
    },
    [loadForBounds]
  );

  const loadByIds = useCallback(
    async (ids: string[]) => {
      const missing = [...new Set(ids.filter(Boolean))].filter((id) => !cacheRef.current.has(id));
      if (missing.length === 0) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchVisitTourCompaniesByIdsAction(missing);
        if (result.error) {
          setError(result.error);
          return;
        }
        mergeCompanies(result.data);
      } finally {
        setIsLoading(false);
      }
    },
    [mergeCompanies]
  );

  const searchCompanies = useCallback(
    async (query: string, bounds: VisitTourGeoBounds | null = null) => {
      const result = await searchVisitTourCompaniesAction(query, bounds);
      if (result.error) {
        setError(result.error);
        return [];
      }
      mergeCompanies(result.data);
      return result.data;
    },
    [mergeCompanies]
  );

  const companies = useMemo(() => {
    void version;
    return Array.from(cacheRef.current.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "it")
    );
  }, [version]);

  const companyById = useMemo(() => {
    void version;
    return new Map(cacheRef.current);
  }, [version]);

  const value = useMemo(
    () => ({
      companies,
      companyById,
      isLoading,
      error,
      loadedCount: companies.length,
      loadForBounds,
      loadForCenter,
      loadForPoints,
      loadByIds,
      searchCompanies,
    }),
    [
      companies,
      companyById,
      error,
      isLoading,
      loadByIds,
      loadForBounds,
      loadForCenter,
      loadForPoints,
      searchCompanies,
    ]
  );

  return (
    <VisitTourCompaniesContext.Provider value={value}>
      {children}
    </VisitTourCompaniesContext.Provider>
  );
}

export function useVisitTourCompanies(): VisitTourCompaniesContextValue {
  const context = useContext(VisitTourCompaniesContext);
  if (!context) {
    throw new Error("useVisitTourCompanies must be used within VisitTourCompaniesProvider");
  }
  return context;
}
