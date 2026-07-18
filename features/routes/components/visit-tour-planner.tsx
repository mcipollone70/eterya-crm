"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ExternalLink,
  Save,
  Sparkles,
} from "lucide-react";
import { MapContainer } from "react-leaflet";
import { PageHeader } from "@/components/ui";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import {
  clearJoyTourProposal,
  loadJoyTourProposal,
} from "@/features/joy/chat/utils/joy-tour-proposal-storage";
import { DEFAULT_MAP_CENTER, FALLBACK_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/features/maps/constants/map-config";
import { OpportunityRadarPanel } from "@/features/radar/components/opportunity-radar-panel";
import type { RadarCompanySource } from "@/features/radar/types";
import { createManualStop } from "@/lib/visit-tour/optimize";
import {
  VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
} from "@/lib/visit-tour/constants";
import { fetchNextActivitiesForCompaniesAction } from "../actions/fetch-agenda-appointments";
import { geocodeDestinationAddressAction } from "../actions/geocode-destination";
import { fetchPriorityContextAction } from "../actions/fetch-priority-context";
import { fetchDrivingRouteAction } from "../actions/fetch-driving-route";
import {
  fetchVisitTourCompaniesByIdsAction,
  fetchVisitTourOptimizeContextAction,
  saveVisitTourAction,
} from "../actions/visit-tour-actions";
import type {
  GeoPoint,
  VisitTourCandidate,
  VisitTourDestination,
  VisitTourDestinationType,
  VisitTourLoadedState,
  VisitTourOptimizePlan,
  VisitTourOptimizeStop,
  VisitTourOriginType,
  VisitTourPlannerMode,
  VisitTourRoute,
  VisitTourSortKey,
  VisitTourGeoBounds,
} from "../types/visit-tour";
import { findCompaniesAlongRoute, toGeoPoint } from "../utils/find-route-candidates";
import {
  buildGoogleMapsTourUrlDetailed,
  tryBuildGoogleMapsTourUrl,
} from "../utils/google-maps-tour-url";
import { applyVisitTourPlannerFilters } from "../utils/visit-tour-filters";
import { optimizeNearestNeighborOrder } from "../utils/visit-tour-nearest-neighbor";
import { sortVisitTourCandidates } from "../utils/visit-tour-sort";
import { VisitTourCandidatesList } from "./visit-tour-candidates-list";
import { VisitTourCorridorStopsList } from "./visit-tour-corridor-stops-list";
import { useVisitTourCompanies } from "./visit-tour-companies-provider";
import { VisitTourMap } from "./visit-tour-map";
import { VisitTourMapLegend } from "./visit-tour-map-legend";
import { VisitTourMapPopup } from "./visit-tour-map-popup";
import { VisitTourOptimizePanel } from "./visit-tour-optimize-panel";
import {
  DEFAULT_PLANNER_FORM,
  VisitTourPlanningForm,
} from "./visit-tour-planning-form";
import { VisitTourSavedList } from "./visit-tour-saved-list";
import { VisitTourSummaryPanel } from "./visit-tour-summary-panel";
import { VISIT_TOUR_INITIAL_RADIUS_KM, VISIT_TOUR_ROUTE_BUFFER_KM } from "../constants/visit-tour-fetch";

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
  const searchParams = useSearchParams();
  const joyProposalLoadedRef = useRef(false);
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
  const [plannerForm, setPlannerForm] = useState(DEFAULT_PLANNER_FORM);
  const [originType, setOriginType] = useState<VisitTourOriginType>("current");
  const [originCompanyId, setOriginCompanyId] = useState("");
  const [originAddressInput, setOriginAddressInput] = useState("");
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [selectedAgendaId, setSelectedAgendaId] = useState("");
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
  const [isSuggestedOrder, setIsSuggestedOrder] = useState(false);
  const [sortKey, setSortKey] = useState<VisitTourSortKey>("distance");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapsWarning, setMapsWarning] = useState<string | null>(null);
  const [tourName, setTourName] = useState("");
  const [savedTourId, setSavedTourId] = useState<string | null>(null);
  const [mapPopupCompany, setMapPopupCompany] = useState<VisitTourCandidate | null>(null);
  const [isPending, startTransition] = useTransition();
  const [radarCenter, setRadarCenter] = useState<GeoPoint | null>(null);
  const [radarLocationError, setRadarLocationError] = useState<string | null>(null);
  const [isRadarLocating, setIsRadarLocating] = useState(true);
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

  const effectiveRadarCenter = useMemo(() => {
    if (mode === "corridor" && origin) {
      return origin;
    }
    if (mode === "optimize" && optimizeOrigin) {
      return optimizeOrigin;
    }
    return radarCenter;
  }, [mode, optimizeOrigin, origin, radarCenter]);

  useEffect(() => {
    let cancelled = false;

    requestCurrentLocation()
      .then((point) => {
        if (cancelled) {
          return;
        }
        setRadarCenter(point);
        setRadarLocationError(null);
        loadForCenter(point, VISIT_TOUR_INITIAL_RADIUS_KM, true);
      })
      .catch((locationError) => {
        if (cancelled) {
          return;
        }
        setRadarLocationError(
          locationError instanceof Error
            ? locationError.message
            : "Impossibile ottenere la posizione corrente."
        );
        const [lat, lng] = FALLBACK_MAP_CENTER;
        loadForCenter({ lat, lng }, VISIT_TOUR_INITIAL_RADIUS_KM, true);
      })
      .finally(() => {
        if (!cancelled) {
          setIsRadarLocating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadForCenter]);

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

  const resolveOrigin = useCallback(async (): Promise<{
    point: GeoPoint;
    label: string;
    companyId?: string;
  }> => {
    if (originType === "current") {
      const point = await requestCurrentLocation();
      return { point, label: "Posizione corrente" };
    }

    if (originType === "company") {
      const company = companyById.get(originCompanyId);
      if (!company) {
        throw new Error("Seleziona un'azienda di partenza.");
      }
      return {
        point: toGeoPoint(company),
        label: company.name,
        companyId: company.id,
      };
    }

    if (!origin) {
      throw new Error("Geocodifica prima l'indirizzo di partenza.");
    }

    return { point: origin, label: originLabel ?? "Partenza manuale" };
  }, [companyById, origin, originCompanyId, originLabel, originType]);

  const resolveDestination = useCallback(async (): Promise<VisitTourDestination> => {
    if (destinationType === "company") {
      const company = companyById.get(selectedCompanyId);
      if (!company) {
        throw new Error("Seleziona un'azienda di destinazione.");
      }
      return {
        type: "company",
        label: company.name,
        point: toGeoPoint(company),
        companyId: company.id,
      };
    }

    if (destinationType === "agenda") {
      if (!selectedAgendaId) {
        throw new Error("Seleziona un appuntamento dall'agenda.");
      }

      const { fetchAgendaAppointmentsForTourAction } = await import(
        "../actions/fetch-agenda-appointments"
      );
      const agendaResult = await fetchAgendaAppointmentsForTourAction(plannerForm.tourDate);
      const appointment = agendaResult.data.find((item) => item.id === selectedAgendaId);
      if (!appointment) {
        throw new Error("Appuntamento agenda non trovato.");
      }

      if (appointment.lat == null || appointment.lng == null) {
        throw new Error("Azienda non geolocalizzata: impossibile usare questo appuntamento come destinazione.");
      }

      return {
        type: "agenda",
        label: appointment.label,
        point: { lat: appointment.lat, lng: appointment.lng },
        companyId: appointment.companyId ?? undefined,
      };
    }

    if (!destination) {
      throw new Error("Geocodifica prima l'indirizzo di destinazione.");
    }

    return destination;
  }, [
    companyById,
    destination,
    destinationType,
    plannerForm.tourDate,
    selectedAgendaId,
    selectedCompanyId,
  ]);

  const handleCalculateRoute = useCallback(() => {
    setMessage(null);
    setError(null);
    setMapsWarning(null);

    startTransition(async () => {
      try {
        const [originResolved, nextDestination] = await Promise.all([
          resolveOrigin(),
          resolveDestination(),
        ]);

        const routeResult = await fetchDrivingRouteAction(
          originResolved.point,
          nextDestination.point
        );
        if (!routeResult.success) {
          setError(routeResult.message);
          return;
        }

        const nextRoute = routeResult.route;
        const routeCompanies = await loadForPoints(
          [originResolved.point, nextDestination.point, ...nextRoute.coordinates],
          Math.max(plannerForm.corridorRadiusKm, VISIT_TOUR_ROUTE_BUFFER_KM),
          true
        );
        const filteredCompanies = applyVisitTourPlannerFilters(
          routeCompanies.length > 0 ? routeCompanies : companies,
          plannerForm.filters
        );
        const priorityContext = await fetchPriorityContextAction();
        const foundCandidates = findCompaniesAlongRoute(
          filteredCompanies,
          nextRoute,
          priorityContext,
          {
            destinationCompanyId: nextDestination.companyId,
            origin: originResolved.point,
            corridorRadiusKm: plannerForm.corridorRadiusKm,
          }
        );

        const nextActivities = await fetchNextActivitiesForCompaniesAction(
          foundCandidates.map((company) => company.id)
        );
        const enrichedCandidates = foundCandidates.map((company) => ({
          ...company,
          nextActivityAt: nextActivities.data[company.id] ?? company.nextActivityAt,
        }));

        setOrigin(originResolved.point);
        setOriginLabel(originResolved.label);
        setDestination(nextDestination);
        setRoute(nextRoute);
        setCandidates(enrichedCandidates);
        setSelectedIds(new Set());
        setSelectionOrder([]);
        setIsSuggestedOrder(false);
        setMessage(
          `Percorso calcolato (${nextRoute.distanceKm.toFixed(1)} km). Trovate ${enrichedCandidates.length} aziende entro ${plannerForm.corridorRadiusKm} km.`
        );
      } catch (routeError) {
        setError(
          routeError instanceof Error ? routeError.message : "Calcolo percorso non riuscito."
        );
      }
    });
  }, [
    companies,
    loadForPoints,
    plannerForm.corridorRadiusKm,
    plannerForm.filters,
    resolveDestination,
    resolveOrigin,
  ]);

  const handleGeocodeOrigin = useCallback(() => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await geocodeDestinationAddressAction(originAddressInput);
      if (!result.success || result.lat === undefined || result.lng === undefined) {
        setError(result.message);
        return;
      }

      setOrigin({ lat: result.lat, lng: result.lng });
      setOriginLabel(result.label ?? originAddressInput.trim());
      setMessage("Partenza geocodificata.");
    });
  }, [originAddressInput]);

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

  const handleOptimizeStopOrder = useCallback(() => {
    if (!origin || selectedWaypoints.length === 0) {
      setError("Seleziona almeno una tappa da ottimizzare.");
      return;
    }

    const optimizedOrder = optimizeNearestNeighborOrder(
      origin,
      selectedWaypoints,
      selectionOrder
    );
    setSelectionOrder(optimizedOrder);
    setIsSuggestedOrder(true);
    setMessage("Ordine suggerito applicato alle tappe selezionate.");
  }, [origin, selectedWaypoints, selectionOrder]);

  const handleMoveStop = useCallback(
    (companyId: string, direction: -1 | 1) => {
      const index = selectionOrder.indexOf(companyId);
      if (index < 0) {
        return;
      }

      const target = index + direction;
      if (target < 0 || target >= selectionOrder.length) {
        return;
      }

      const nextOrder = [...selectionOrder];
      const current = nextOrder[index]!;
      nextOrder[index] = nextOrder[target]!;
      nextOrder[target] = current;
      setSelectionOrder(nextOrder);
      setIsSuggestedOrder(false);
    },
    [selectionOrder]
  );

  const handleClearStops = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionOrder([]);
    setIsSuggestedOrder(false);
  }, []);

  const handleSaveCorridorTour = useCallback(() => {
    if (!origin || !destination || !route || selectedWaypoints.length === 0) {
      setError("Calcola il percorso e seleziona almeno una tappa prima di salvare.");
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(async () => {
      const context = await fetchVisitTourOptimizeContextAction();
      const stops = selectedWaypoints.map((company, index) =>
        createManualStop(company, index + 1, origin, destination.point, context)
      );
      const visitMinutes = selectedWaypoints.length * plannerForm.visitDurationMin;
      const drivingMinutes = Math.round((route.distanceKm / 45) * 60);

      const result = await saveVisitTourAction({
        tourId: savedTourId,
        name: tourName.trim() || null,
        tourDate: plannerForm.tourDate,
        mode: "corridor",
        origin: {
          ...origin,
          label: originLabel ?? "Partenza",
          companyId: originType === "company" ? originCompanyId : undefined,
        },
        destination: {
          ...destination.point,
          label: destination.label,
          companyId: destination.companyId,
        },
        constraints: {
          maxDurationMinutes: drivingMinutes + visitMinutes,
          maxStops: selectedWaypoints.length,
          maxDeviationKm: plannerForm.corridorRadiusKm,
        },
        stops,
        totalDistanceKm: route.distanceKm,
        estimatedMinutes: drivingMinutes + visitMinutes,
        deviationKm: 0,
        status: "planned",
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      if (result.tourId) {
        setSavedTourId(result.tourId);
      }
      setMessage(result.message);
      setSavedListRefreshKey((current) => current + 1);
    });
  }, [
    destination,
    origin,
    originCompanyId,
    originLabel,
    originType,
    plannerForm.corridorRadiusKm,
    plannerForm.tourDate,
    plannerForm.visitDurationMin,
    route,
    savedTourId,
    selectedWaypoints,
    tourName,
  ]);

  const googleMapsTour =
    origin && destination
      ? (() => {
          try {
            return buildGoogleMapsTourUrlDetailed(
              origin,
              destination.point,
              selectedWaypoints.map((company) => ({
                lat: company.latitude,
                lng: company.longitude,
              }))
            );
          } catch {
            const url = tryBuildGoogleMapsTourUrl(
              origin,
              destination.point,
              selectedWaypoints.map((company) => ({
                lat: company.latitude,
                lng: company.longitude,
              }))
            );
            return url
              ? { url, waypointCount: selectedWaypoints.length, truncated: false, warning: null }
              : null;
          }
        })()
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

  // Carica proposta Joy Drive (query params e/o sessionStorage) in Ottimizza giro.
  useEffect(() => {
    if (joyProposalLoadedRef.current) {
      return;
    }

    const fromQuery = searchParams.get("joy") === "1";
    const stored = loadJoyTourProposal();
    const stopsParam = searchParams.get("stops");
    const stopIdsFromQuery = stopsParam
      ? stopsParam.split(",").map((id) => id.trim()).filter(Boolean)
      : [];

    const stopIds =
      stopIdsFromQuery.length > 0
        ? stopIdsFromQuery
        : stored?.stopCompanyIds ?? [];

    if ((!fromQuery && !stored) || stopIds.length === 0) {
      return;
    }

    joyProposalLoadedRef.current = true;

    const olat = Number(searchParams.get("olat") ?? stored?.origin.lat);
    const olng = Number(searchParams.get("olng") ?? stored?.origin.lng);
    const dlat = Number(searchParams.get("dlat") ?? stored?.destination.lat);
    const dlng = Number(searchParams.get("dlng") ?? stored?.destination.lng);
    const olabel =
      searchParams.get("olabel") ?? stored?.origin.label ?? "Partenza Joy";
    const dayParam = searchParams.get("day") ?? stored?.day ?? "today";
    const hasOrigin = Number.isFinite(olat) && Number.isFinite(olng);
    const hasDest = Number.isFinite(dlat) && Number.isFinite(dlng);

    void (async () => {
      const [companiesResult, context] = await Promise.all([
        fetchVisitTourCompaniesByIdsAction(stopIds),
        fetchVisitTourOptimizeContextAction(),
      ]);

      if (companiesResult.error) {
        setError(companiesResult.error);
        return;
      }

      const byId = new Map(companiesResult.data.map((company) => [company.id, company]));
      const orderedCompanies = stopIds
        .map((id) => byId.get(id))
        .filter((company): company is NonNullable<typeof company> => Boolean(company));

      if (orderedCompanies.length === 0) {
        setError(
          "Proposta Joy ricevuta ma nessuna azienda geolocalizzata trovata. Verifica i dati CRM."
        );
        return;
      }

      await loadByIds(stopIds);

      const originPoint: GeoPoint = hasOrigin
        ? { lat: olat, lng: olng }
        : {
            lat: orderedCompanies[0]!.latitude,
            lng: orderedCompanies[0]!.longitude,
          };
      const last = orderedCompanies[orderedCompanies.length - 1]!;
      const destinationPoint: GeoPoint = hasDest
        ? { lat: dlat, lng: dlng }
        : { lat: last.latitude, lng: last.longitude };

      const stops: VisitTourOptimizeStop[] = orderedCompanies.map((company, index) =>
        createManualStop(
          {
            id: company.id,
            name: company.name,
            city: company.city,
            province: company.province,
            latitude: company.latitude,
            longitude: company.longitude,
            phone: company.phone,
            revenue: company.revenue,
            lastVisitAt: company.lastVisitAt,
            commercial_status: company.commercial_status,
            status: company.status,
            import_payload: company.import_payload,
          },
          index + 1,
          originPoint,
          destinationPoint,
          context
        )
      );

      const totalDistanceKm =
        stored?.totalDistanceKm ??
        stops.reduce((sum, stop) => sum + stop.legDistanceKm, 0);
      const estimatedMinutes =
        stored?.estimatedMinutes ??
        Math.round((totalDistanceKm / 45) * 60) + stops.length * 15;

      const tourDate = (() => {
        const d = new Date();
        if (dayParam === "tomorrow") {
          d.setDate(d.getDate() + 1);
        }
        return d.toISOString().slice(0, 10);
      })();

      const plan: VisitTourOptimizePlan = {
        stops,
        totalDistanceKm,
        estimatedMinutes,
        totalDeviationKm: 0,
      };

      const joyTour: VisitTourLoadedState = {
        id: `joy-proposal-${Date.now()}`,
        name: `Proposta Joy · ${stops.length} tappe`,
        tourDate,
        notes:
          "Proposta Joy Drive — non salvata automaticamente. Conferma e salva da qui se vuoi.",
        originType: "address",
        originCompanyId: "",
        originLabel: olabel,
        origin: originPoint,
        destinationType: "address",
        destinationCompanyId: last.id,
        destination: {
          type: "address",
          label: searchParams.get("to") ?? last.city ?? last.name,
          point: destinationPoint,
          companyId: last.id,
        },
        constraints: {
          maxDurationMinutes: Math.max(estimatedMinutes, VISIT_TOUR_DEFAULT_MAX_DURATION_MIN),
          maxStops: stops.length,
          maxDeviationKm: VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
        },
        stops,
        plan,
      };

      handleOpenSavedTour(joyTour);
      setMessage(
        `Proposta Joy caricata: ${stops.length} tappe. Nessun salvataggio automatico — usa Salva quando sei pronto.`
      );
      clearJoyTourProposal();
      loadForPoints(
        [
          originPoint,
          destinationPoint,
          ...orderedCompanies.map((company) => ({
            lat: company.latitude,
            lng: company.longitude,
          })),
        ],
        VISIT_TOUR_ROUTE_BUFFER_KM,
        true
      );
    })();
  }, [handleOpenSavedTour, loadByIds, loadForPoints, searchParams]);

  const optimizeMapStops = useMemo(
    () =>
      (optimizePlan?.stops ?? []).map((stop) => ({
        id: stop.id,
        name: stop.company.name,
        city: stop.company.city ?? null,
        province: stop.company.province ?? null,
        address: null,
        phone: stop.company.phone ?? null,
        email: null,
        commercial_status: stop.company.commercial_status,
        status: stop.company.status,
        latitude: stop.company.latitude,
        longitude: stop.company.longitude,
        revenue: stop.company.revenue ?? null,
        lastVisitAt: stop.company.lastVisitAt,
        nextActivityAt: null,
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
        subtitle="Organizza il percorso commerciale e individua le aziende vicine al tragitto."
        actions={<JoyAiPageLink prompt="Organizza il mio giro visite per domani" />}
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
        <div className="space-y-4">
          <VisitTourPlanningForm
            originType={originType}
            destinationType={destinationType}
            originCompanyId={originCompanyId}
            destinationCompanyId={selectedCompanyId}
            selectedAgendaId={selectedAgendaId}
            originAddressInput={originAddressInput}
            destinationAddressInput={addressInput}
            form={plannerForm}
            onOriginTypeChange={setOriginType}
            onDestinationTypeChange={setDestinationType}
            onOriginCompanyIdChange={setOriginCompanyId}
            onDestinationCompanyIdChange={setSelectedCompanyId}
            onSelectedAgendaIdChange={setSelectedAgendaId}
            onOriginAddressInputChange={setOriginAddressInput}
            onDestinationAddressInputChange={setAddressInput}
            onFormChange={setPlannerForm}
            onGeocodeOrigin={handleGeocodeOrigin}
            onGeocodeDestination={handleGeocodeAddress}
            onCalculateRoute={handleCalculateRoute}
            isPending={isPending}
            originLabel={originLabel}
            destinationLabel={destination?.label ?? null}
          />

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
            <>
              <VisitTourSummaryPanel
                stopCount={selectedWaypoints.length}
                totalDistanceKm={route.distanceKm}
                drivingMinutes={Math.round((route.distanceKm / 45) * 60)}
                visitDurationMin={plannerForm.visitDurationMin}
                departureTime={plannerForm.departureTime}
                maxArrivalTime={plannerForm.maxArrivalTime}
              />

              <VisitTourCandidatesList
                candidates={sortedCandidates}
                selectedIds={selectedIds}
                sortKey={sortKey}
                onSortChange={setSortKey}
                onToggleCompany={handleToggleCompany}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOptimizeStopOrder}
                  disabled={selectedWaypoints.length < 2}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Ottimizza ordine tappe
                </button>
              </div>

              <VisitTourCorridorStopsList
                stops={selectedWaypoints}
                selectionOrder={selectionOrder}
                isSuggestedOrder={isSuggestedOrder}
                onToggleCompany={handleToggleCompany}
                onMoveUp={(companyId) => handleMoveStop(companyId, -1)}
                onMoveDown={(companyId) => handleMoveStop(companyId, 1)}
                onClearAll={handleClearStops}
              />

              <label className="block text-xs font-medium text-slate-700">
                Nome giro
                <input
                  type="text"
                  value={tourName}
                  onChange={(event) => setTourName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Es. Giro zona est"
                />
              </label>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={handleSaveCorridorTour}
                  disabled={isPending || selectedWaypoints.length === 0}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  <Save className="h-4 w-4" />
                  Salva giro
                </button>

                {googleMapsTour && (
                  <a
                    href={googleMapsTour.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMapsWarning(googleMapsTour.warning)}
                    data-testid="google-maps-corridor-link"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apri in Google Maps
                  </a>
                )}
              </div>

              {mapsWarning && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {mapsWarning}
                </p>
              )}
            </>
          )}
        </div>
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

        <div
          className="relative min-h-[320px] overflow-hidden rounded-xl border border-slate-200 shadow-sm h-[min(52dvh,calc(100dvh-14rem))] lg:min-h-[520px] lg:h-auto"
          data-testid="visit-tour-map-shell"
        >
          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            className="absolute inset-0 z-0 h-full w-full lg:static lg:min-h-[520px]"
            style={{ height: "100%", width: "100%" }}
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
              candidateCompanies={mode === "corridor" ? sortedCandidates : []}
              selectedCompanies={mode === "corridor" ? selectedCandidates : optimizeMapStops}
              origin={mode === "corridor" ? origin : optimizeOrigin}
              orderedStopIds={
                mode === "corridor"
                  ? selectionOrder.filter((id) => selectedIds.has(id))
                  : optimizeMapStops.map((stop) => stop.id)
              }
              onViewportChange={handleMapViewportChange}
              onCompanyClick={setMapPopupCompany}
            />
          </MapContainer>
          <VisitTourMapLegend />
          {mapPopupCompany && (
            <VisitTourMapPopup
              company={mapPopupCompany}
              onClose={() => setMapPopupCompany(null)}
            />
          )}
        </div>
      </div>

      <OpportunityRadarPanel
        companies={radarCompanies}
        center={effectiveRadarCenter}
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
