"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, ExternalLink, Loader2, Navigation, Route } from "lucide-react";
import { MapContainer } from "react-leaflet";
import { PageHeader } from "@/components/ui";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/features/maps/constants/map-config";
import { OpportunityRadarPanel } from "@/features/radar/components/opportunity-radar-panel";
import type { RadarCompanySource } from "@/features/radar/types";
import { geocodeDestinationAddressAction } from "../actions/geocode-destination";
import type {
  GeoPoint,
  VisitTourCandidate,
  VisitTourDestination,
  VisitTourDestinationType,
  VisitTourLoadedState,
  VisitTourOptimizePlan,
  VisitTourPlannerMode,
  VisitTourRoute,
  VisitTourSortKey,
} from "../types/visit-tour";
import { fetchPriorityContextAction } from "../actions/fetch-priority-context";
import { fetchDrivingRouteAction } from "../actions/fetch-driving-route";
import { findCompaniesAlongRoute, toGeoPoint } from "../utils/find-route-candidates";
import { buildGoogleMapsTourUrl } from "../utils/google-maps-tour-url";
import { sortVisitTourCandidates } from "../utils/visit-tour-sort";
import { VisitTourCandidatesList } from "./visit-tour-candidates-list";
import { useVisitTourCompanies } from "./visit-tour-companies-provider";
import { VisitTourCompanySelect } from "./visit-tour-company-select";
import { VisitTourMap } from "./visit-tour-map";
import { VisitTourOptimizePanel } from "./visit-tour-optimize-panel";
import { VisitTourSavedList } from "./visit-tour-saved-list";
import { VISIT_TOUR_INITIAL_RADIUS_KM, VISIT_TOUR_ROUTE_BUFFER_KM } from "../constants/visit-tour-fetch";
import type { VisitTourGeoBounds } from "../types/visit-tour";

type VisitTourPageTab = "plan" | "saved";

interface VisitTourPlannerProps {
  agents: Array<{ id: string; label: string }>;
}

function requestCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalizzazione non supportata dal browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        reject(new Error("Impossibile ottenere la posizione corrente."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export function VisitTourPlanner({ agents }: VisitTourPlannerProps) {
  const {
    companies,
    companyById,
    isLoading: isCompaniesLoading,
    loadForBounds,
    loadForCenter,
    loadForPoints,
    loadByIds,
  } = useVisitTourCompanies();
  const [pageTab, setPageTab] = useState<VisitTourPageTab>("plan");
  const [mode, setMode] = useState<VisitTourPlannerMode>("corridor");
  const [loadedTour, setLoadedTour] = useState<VisitTourLoadedState | null>(null);
  const [optimizePlan, setOptimizePlan] = useState<VisitTourOptimizePlan | null>(null);
  const [optimizeOrigin, setOptimizeOrigin] = useState<GeoPoint | null>(null);
  const [optimizeDestination, setOptimizeDestination] = useState<GeoPoint | null>(null);
  const [destinationType, setDestinationType] =
    useState<VisitTourDestinationType>("company");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [destination, setDestination] = useState<VisitTourDestination | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [route, setRoute] = useState<VisitTourRoute | null>(null);
  const [candidates, setCandidates] = useState<VisitTourCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<VisitTourSortKey>("distance");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [radarCenter, setRadarCenter] = useState<GeoPoint | null>(null);
  const [radarLocationError, setRadarLocationError] = useState<string | null>(null);
  const [isRadarLocating, setIsRadarLocating] = useState(false);
  const [savedListRefreshKey, setSavedListRefreshKey] = useState(0);

  const radarCompanies = useMemo(
    () =>
      companies.map(
        (company): RadarCompanySource => ({
          id: company.id,
          name: company.name,
          city: company.city,
          province: company.province,
          phone: company.phone,
          latitude: company.latitude,
          longitude: company.longitude,
          commercial_status: company.commercial_status,
        })
      ),
    [companies]
  );

  useEffect(() => {
    setIsRadarLocating(true);
    requestCurrentLocation()
      .then((point) => {
        setRadarCenter(point);
        setRadarLocationError(null);
        loadForCenter(point, VISIT_TOUR_INITIAL_RADIUS_KM, true);
      })
      .catch((locationError) => {
        setRadarLocationError(
          locationError instanceof Error
            ? locationError.message
            : "Impossibile ottenere la posizione corrente."
        );
        const [lat, lng] = DEFAULT_MAP_CENTER;
        loadForCenter({ lat, lng }, VISIT_TOUR_INITIAL_RADIUS_KM, true);
      })
      .finally(() => setIsRadarLocating(false));
  }, [loadForCenter]);

  useEffect(() => {
    if (mode === "corridor" && origin) {
      setRadarCenter(origin);
    } else if (mode === "optimize" && optimizeOrigin) {
      setRadarCenter(optimizeOrigin);
    }
  }, [mode, origin, optimizeOrigin]);

  const handleRefreshRadarLocation = useCallback(() => {
    setIsRadarLocating(true);
    setRadarLocationError(null);
    requestCurrentLocation()
      .then((point) => {
        setRadarCenter(point);
        loadForCenter(point, VISIT_TOUR_INITIAL_RADIUS_KM, true);
      })
      .catch((locationError) => {
        setRadarLocationError(
          locationError instanceof Error
            ? locationError.message
            : "Impossibile ottenere la posizione corrente."
        );
      })
      .finally(() => setIsRadarLocating(false));
  }, [loadForCenter]);

  const handleMapViewportChange = useCallback(
    (bounds: VisitTourGeoBounds) => {
      loadForBounds(bounds);
    },
    [loadForBounds]
  );

  const sortedCandidates = useMemo(
    () => sortVisitTourCandidates(candidates, sortKey),
    [candidates, sortKey]
  );

  const selectedCandidates = useMemo(
    () => sortedCandidates.filter((company) => selectedIds.has(company.id)),
    [selectedIds, sortedCandidates]
  );

  const handleToggleCompany = useCallback((companyId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(companyId)) {
        next.delete(companyId);
        setSelectionOrder((order) => order.filter((id) => id !== companyId));
      } else {
        next.add(companyId);
        setSelectionOrder((order) => [...order, companyId]);
      }
      return next;
    });
  }, []);

  const handleCalculateRoute = useCallback(() => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        let nextDestination = destination;

        if (destinationType === "company") {
          const company = companyById.get(selectedCompanyId);
          if (!company) {
            setError("Seleziona un'azienda di destinazione.");
            return;
          }
          nextDestination = {
            type: "company",
            label: company.name,
            point: toGeoPoint(company),
            companyId: company.id,
          };
        } else if (!nextDestination) {
          setError("Geocodifica prima l'indirizzo di destinazione.");
          return;
        }

        const currentOrigin = await requestCurrentLocation();
        const routeResult = await fetchDrivingRouteAction(
          currentOrigin,
          nextDestination.point
        );
        if (!routeResult.success) {
          setError(routeResult.message);
          return;
        }
        const nextRoute = routeResult.route;
        const routeCompanies = await loadForPoints(
          [currentOrigin, nextDestination.point, ...nextRoute.coordinates],
          VISIT_TOUR_ROUTE_BUFFER_KM,
          true
        );
        const scopedCompanies =
          routeCompanies.length > 0
            ? routeCompanies
            : companies;
        const priorityContext = await fetchPriorityContextAction();
        const foundCandidates = findCompaniesAlongRoute(
          scopedCompanies,
          nextRoute,
          priorityContext,
          {
            destinationCompanyId: nextDestination.companyId,
            origin: currentOrigin,
          }
        );

        setOrigin(currentOrigin);
        setDestination(nextDestination);
        setRoute(nextRoute);
        setCandidates(foundCandidates);
        setSelectedIds(new Set());
        setSelectionOrder([]);
        setMessage(
          `Percorso calcolato (${nextRoute.distanceKm.toFixed(1)} km). Trovate ${foundCandidates.length} aziende entro 2 km.`
        );
      } catch (routeError) {
        setError(
          routeError instanceof Error ? routeError.message : "Calcolo percorso non riuscito."
        );
      }
    });
  }, [companies, companyById, destination, destinationType, loadForPoints, selectedCompanyId]);

  const handleGeocodeAddress = useCallback(() => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await geocodeDestinationAddressAction(addressInput);
      if (!result.success || result.lat === undefined || result.lng === undefined) {
        setError(result.message);
        return;
      }

      setDestination({
        type: "address",
        label: result.label ?? addressInput.trim(),
        point: { lat: result.lat, lng: result.lng },
      });
      setMessage(result.message);
    });
  }, [addressInput]);

  const selectedWaypoints = useMemo(() => {
    const candidateById = new Map(candidates.map((company) => [company.id, company]));
    return selectionOrder
      .filter((id) => selectedIds.has(id))
      .map((id) => candidateById.get(id))
      .filter((company): company is VisitTourCandidate => company !== undefined);
  }, [candidates, selectedIds, selectionOrder]);

  const googleMapsTourUrl =
    origin && destination
      ? buildGoogleMapsTourUrl(
          origin,
          destination.point,
          selectedWaypoints.map((company) => ({
            lat: company.latitude,
            lng: company.longitude,
          }))
        )
      : null;

  const handleOptimizePlanChange = useCallback(
    (plan: VisitTourOptimizePlan | null, nextOrigin: GeoPoint | null, nextDestination: GeoPoint | null) => {
      setOptimizePlan(plan);
      setOptimizeOrigin(nextOrigin);
      setOptimizeDestination(nextDestination);
    },
    []
  );

  const handleOpenSavedTour = useCallback(
    (tour: VisitTourLoadedState) => {
      setLoadedTour(tour);
      setPageTab("plan");
      setMode("optimize");
      void loadByIds([
        ...tour.stops.map((stop) => stop.id),
        tour.originCompanyId,
        tour.destinationCompanyId,
      ].filter(Boolean));
      loadForPoints(
        [tour.origin, tour.destination.point, ...tour.stops.map((stop) => ({
          lat: stop.company.latitude,
          lng: stop.company.longitude,
        }))],
        VISIT_TOUR_ROUTE_BUFFER_KM,
        true
      );
    },
    [loadByIds, loadForPoints]
  );

  const optimizeMapStops = useMemo(
    () =>
      (optimizePlan?.stops ?? []).map((stop) => ({
        id: stop.id,
        name: stop.company.name,
        city: stop.company.city ?? null,
        province: stop.company.province ?? null,
        phone: stop.company.phone ?? null,
        commercial_status: stop.company.commercial_status,
        status: stop.company.status,
        latitude: stop.company.latitude,
        longitude: stop.company.longitude,
        revenue: stop.company.revenue ?? null,
        lastVisitAt: stop.company.lastVisitAt,
        import_payload: stop.company.import_payload ?? null,
        distanceFromRouteKm: stop.deviationKm,
        distanceBand: "2km" as const,
        priorityScore: stop.score,
        priorityTier: "medium" as const,
        potentialScore: stop.score,
        order: stop.order,
      })),
    [optimizePlan]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Giro Visite"
        subtitle="Pianifica un percorso verso la destinazione o ottimizza un giro multi-tappa."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPageTab("plan")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            pageTab === "plan"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Pianifica
        </button>
        <button
          type="button"
          onClick={() => setPageTab("saved")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            pageTab === "saved"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Giri salvati
        </button>
      </div>

      {pageTab === "saved" ? (
        <VisitTourSavedList
          key={savedListRefreshKey}
          agents={agents}
          onOpenTour={handleOpenSavedTour}
        />
      ) : (
        <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("corridor")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "corridor"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Percorso lungo strada
        </button>
        <button
          type="button"
          onClick={() => setMode("optimize")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "optimize"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Ottimizza giro
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        {mode === "corridor" ? (
        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Destinazione</h3>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDestinationType("company")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  destinationType === "company"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Azienda
              </button>
              <button
                type="button"
                onClick={() => setDestinationType("address")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  destinationType === "address"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Indirizzo
              </button>
            </div>
          </div>

          {destinationType === "company" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Azienda di destinazione</span>
              <VisitTourCompanySelect
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                pinnedIds={selectedCompanyId ? [selectedCompanyId] : []}
              />
            </label>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Indirizzo di destinazione</span>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(event) => setAddressInput(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Via, civico, comune, provincia"
                />
              </label>
              <button
                type="button"
                onClick={handleGeocodeAddress}
                disabled={isPending || !addressInput.trim()}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Geocodifica indirizzo
              </button>
              {destination?.type === "address" && (
                <p className="text-xs text-emerald-700">{destination.label}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCalculateRoute}
            disabled={isPending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Route className="h-4 w-4" />
            )}
            Calcola percorso
          </button>

          {origin && (
            <p className="flex items-start gap-2 text-xs text-slate-600">
              <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Partenza dalla posizione corrente ({origin.lat.toFixed(4)}, {origin.lng.toFixed(4)})
            </p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {message && !error && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}

          {route && (
            <VisitTourCandidatesList
              candidates={sortedCandidates}
              selectedIds={selectedIds}
              sortKey={sortKey}
              onSortChange={setSortKey}
              onToggleCompany={handleToggleCompany}
            />
          )}

          {googleMapsTourUrl && (
            <a
              href={googleMapsTourUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <ExternalLink className="h-4 w-4" />
              Apri il giro visite su Google Maps
            </a>
          )}
        </aside>
        ) : (
          <>
          {isCompaniesLoading && companies.length === 0 && (
            <p className="text-xs text-slate-500">Caricamento aziende nell&apos;area visibile…</p>
          )}

          <VisitTourOptimizePanel
            key={loadedTour?.id ?? "new-tour"}
            loadedTour={loadedTour}
            onPlanChange={handleOptimizePlanChange}
            onTourSaved={() => setSavedListRefreshKey((current) => current + 1)}
          />
          </>
        )}

        <div className="min-h-[520px] overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            className="h-full min-h-[520px] w-full"
            scrollWheelZoom
          >
            <VisitTourMap
              routeCoordinates={mode === "corridor" ? (route?.coordinates ?? []) : []}
              destination={
                mode === "corridor"
                  ? destination
                  : optimizeDestination
                    ? {
                        type: "address",
                        label: "Arrivo",
                        point: optimizeDestination,
                      }
                    : null
              }
              selectedCompanies={mode === "corridor" ? selectedCandidates : optimizeMapStops}
              origin={mode === "corridor" ? origin : optimizeOrigin}
              orderedStopIds={
                mode === "optimize" ? optimizeMapStops.map((stop) => stop.id) : undefined
              }
              onViewportChange={handleMapViewportChange}
            />
          </MapContainer>
        </div>
      </div>

      <OpportunityRadarPanel
        companies={radarCompanies}
        center={radarCenter}
        isLocating={isRadarLocating}
        locationError={radarLocationError}
        onRequestLocation={handleRefreshRadarLocation}
        layout="overlay"
      />
        </>
      )}
    </div>
  );
}
