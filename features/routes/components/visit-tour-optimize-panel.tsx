"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Navigation,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { formatDurationMinutes } from "@/lib/last-visit/format";
import {
  createManualStop,
  optimizeVisitTour,
} from "@/lib/visit-tour/optimize";
import {
  VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
  VISIT_TOUR_DEFAULT_MAX_STOPS,
} from "@/lib/visit-tour/constants";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";
import { geocodeDestinationAddressAction } from "../actions/geocode-destination";
import {
  fetchVisitTourOptimizeContextAction,
  saveVisitTourAction,
} from "../actions/visit-tour-actions";
import type {
  GeoPoint,
  VisitTourCompany,
  VisitTourConstraints,
  VisitTourDestination,
  VisitTourDestinationType,
  VisitTourOptimizePlan,
  VisitTourOptimizeStop,
} from "../types/visit-tour";
import { buildGoogleMapsTourUrl } from "../utils/google-maps-tour-url";
import { toGeoPoint } from "../utils/find-route-candidates";
import { VisitTourStopsList } from "./visit-tour-stops-list";

interface VisitTourOptimizePanelProps {
  companies: VisitTourCompany[];
  onPlanChange: (
    plan: VisitTourOptimizePlan | null,
    origin: GeoPoint | null,
    destination: GeoPoint | null
  ) => void;
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

function normalizeStopsOrder(stops: VisitTourOptimizeStop[]): VisitTourOptimizeStop[] {
  return stops.map((stop, index) => ({ ...stop, order: index + 1 }));
}

export function VisitTourOptimizePanel({ companies, onPlanChange }: VisitTourOptimizePanelProps) {
  const [originType, setOriginType] = useState<"current" | VisitTourDestinationType>("current");
  const [destinationType, setDestinationType] =
    useState<VisitTourDestinationType>("company");
  const [originCompanyId, setOriginCompanyId] = useState("");
  const [destinationCompanyId, setDestinationCompanyId] = useState("");
  const [originAddressInput, setOriginAddressInput] = useState("");
  const [destinationAddressInput, setDestinationAddressInput] = useState("");
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [originLabel, setOriginLabel] = useState("Posizione corrente");
  const [destination, setDestination] = useState<VisitTourDestination | null>(null);
  const [constraints, setConstraints] = useState<VisitTourConstraints>({
    maxDurationMinutes: VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
    maxStops: VISIT_TOUR_DEFAULT_MAX_STOPS,
    maxDeviationKm: VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
  });
  const [plan, setPlan] = useState<VisitTourOptimizePlan | null>(null);
  const [stops, setStops] = useState<VisitTourOptimizeStop[]>([]);
  const [optimizeContext, setOptimizeContext] = useState<VisitTourOptimizeContext | null>(null);
  const [manualCompanyId, setManualCompanyId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableManualCompanies = useMemo(
    () => companies.filter((company) => !stops.some((stop) => stop.id === company.id)),
    [companies, stops]
  );

  const syncPlan = useCallback(
    (
      nextStops: VisitTourOptimizeStop[],
      nextPlan: VisitTourOptimizePlan | null,
      nextOrigin: GeoPoint | null = origin,
      nextDestination: GeoPoint | null = destination?.point ?? null
    ) => {
      setStops(nextStops);
      setPlan(nextPlan);
      onPlanChange(nextPlan, nextOrigin, nextDestination);
    },
    [destination?.point, onPlanChange, origin]
  );

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
      const company = companies.find((item) => item.id === originCompanyId);
      if (!company) {
        throw new Error("Seleziona il punto di partenza.");
      }
      return {
        point: toGeoPoint(company),
        label: company.name,
        companyId: company.id,
      };
    }

    if (!origin) {
      throw new Error("Geocodifica prima il punto di partenza.");
    }

    return { point: origin, label: originLabel };
  }, [companies, origin, originCompanyId, originLabel, originType]);

  const resolveDestination = useCallback((): VisitTourDestination => {
    if (destinationType === "company") {
      const company = companies.find((item) => item.id === destinationCompanyId);
      if (!company) {
        throw new Error("Seleziona il punto di arrivo.");
      }
      return {
        type: "company",
        label: company.name,
        point: toGeoPoint(company),
        companyId: company.id,
      };
    }

    if (!destination) {
      throw new Error("Geocodifica prima il punto di arrivo.");
    }

    return destination;
  }, [companies, destination, destinationCompanyId, destinationType]);

  const runOptimize = useCallback(
    (recalculate: boolean) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        try {
          const [originResolved, destinationResolved, context] = await Promise.all([
            resolveOrigin(),
            Promise.resolve(resolveDestination()),
            optimizeContext ? Promise.resolve(optimizeContext) : fetchVisitTourOptimizeContextAction(),
          ]);

          if (!optimizeContext) {
            setOptimizeContext(context);
          }

          setOrigin(originResolved.point);
          setOriginLabel(originResolved.label);
          setDestination(destinationResolved);

          const nextPlan = optimizeVisitTour({
            origin: originResolved.point,
            destination: destinationResolved.point,
            companies,
            context,
            constraints,
            existingStops: recalculate ? stops : [],
            originCompanyId: originResolved.companyId,
            destinationCompanyId: destinationResolved.companyId,
          });

          syncPlan(nextPlan.stops, nextPlan, originResolved.point, destinationResolved.point);
          setMessage(
            recalculate
              ? `Giro ricalcolato: ${nextPlan.stops.length} tappe, ${formatDistanceKm(nextPlan.totalDistanceKm)}, ${formatDurationMinutes(nextPlan.estimatedMinutes)}.`
              : `Giro ottimizzato: ${nextPlan.stops.length} tappe selezionate.`
          );
        } catch (optimizeError) {
          setError(
            optimizeError instanceof Error
              ? optimizeError.message
              : "Ottimizzazione non riuscita."
          );
        }
      });
    },
    [
      companies,
      constraints,
      optimizeContext,
      resolveDestination,
      resolveOrigin,
      stops,
      syncPlan,
    ]
  );

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

  const handleGeocodeDestination = useCallback(() => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await geocodeDestinationAddressAction(destinationAddressInput);
      if (!result.success || result.lat === undefined || result.lng === undefined) {
        setError(result.message);
        return;
      }

      setDestination({
        type: "address",
        label: result.label ?? destinationAddressInput.trim(),
        point: { lat: result.lat, lng: result.lng },
      });
      setMessage("Arrivo geocodificato.");
    });
  }, [destinationAddressInput]);

  const handleRemoveStop = useCallback(
    (companyId: string) => {
      const nextStops = normalizeStopsOrder(stops.filter((stop) => stop.id !== companyId));
      const nextPlan = plan ? { ...plan, stops: nextStops } : null;
      syncPlan(nextStops, nextPlan);
    },
    [plan, stops, syncPlan]
  );

  const handleMoveStop = useCallback(
    (companyId: string, direction: -1 | 1) => {
      const index = stops.findIndex((stop) => stop.id === companyId);
      if (index < 0) {
        return;
      }

      const target = index + direction;
      if (target < 0 || target >= stops.length) {
        return;
      }

      const nextStops = [...stops];
      const current = nextStops[index]!;
      nextStops[index] = nextStops[target]!;
      nextStops[target] = current;
      const normalized = normalizeStopsOrder(nextStops);
      const nextPlan = plan ? { ...plan, stops: normalized } : null;
      syncPlan(normalized, nextPlan);
    },
    [plan, stops, syncPlan]
  );

  const handleToggleLock = useCallback(
    (companyId: string) => {
      const normalized = normalizeStopsOrder(
        stops.map((stop) =>
          stop.id === companyId ? { ...stop, locked: !stop.locked } : stop
        )
      );
      const nextPlan = plan ? { ...plan, stops: normalized } : null;
      syncPlan(normalized, nextPlan);
    },
    [plan, stops, syncPlan]
  );

  const handleAddManualStop = useCallback(() => {
    if (!manualCompanyId || !origin || !destination?.point) {
      setError("Configura partenza e arrivo prima di aggiungere una tappa.");
      return;
    }

    const company = companies.find((item) => item.id === manualCompanyId);
    if (!company) {
      return;
    }

    startTransition(async () => {
      const context = optimizeContext ?? (await fetchVisitTourOptimizeContextAction());
      if (!optimizeContext) {
        setOptimizeContext(context);
      }

      const manualStop = createManualStop(
        company,
        stops.length + 1,
        origin,
        destination.point,
        context
      );
      const nextStops = normalizeStopsOrder([...stops, manualStop]);
      const nextPlan = plan
        ? { ...plan, stops: nextStops }
        : {
            stops: nextStops,
            totalDistanceKm: 0,
            estimatedMinutes: 0,
            totalDeviationKm: 0,
          };
      syncPlan(nextStops, nextPlan);
      setManualCompanyId("");
      setMessage("Tappa aggiunta manualmente.");
    });
  }, [companies, destination, manualCompanyId, optimizeContext, origin, plan, stops, syncPlan]);

  const handleSaveTour = useCallback(() => {
    if (!plan || !origin || !destination) {
      setError("Calcola prima un giro da salvare.");
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await saveVisitTourAction({
        tourDate: new Date().toISOString().slice(0, 10),
        origin: {
          ...origin,
          label: originLabel,
          companyId: originType === "company" ? originCompanyId : undefined,
        },
        destination: {
          ...destination.point,
          label: destination.label,
          companyId: destination.companyId,
        },
        constraints,
        stops,
        totalDistanceKm: plan.totalDistanceKm,
        estimatedMinutes: plan.estimatedMinutes,
        deviationKm: plan.totalDeviationKm,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    });
  }, [
    constraints,
    destination,
    notes,
    origin,
    originCompanyId,
    originLabel,
    originType,
    plan,
    stops,
  ]);

  const googleMapsTourUrl =
    origin && destination
      ? buildGoogleMapsTourUrl(
          origin,
          destination.point,
          stops.map((stop) => ({
            lat: stop.company.latitude,
            lng: stop.company.longitude,
          }))
        )
      : null;

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Ottimizza giro</h3>
        <p className="mt-1 text-xs text-slate-500">
          Seleziona vincoli e genera un percorso multi-tappa in base a priorità e distanza.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">Punto di partenza</p>
          <div className="flex flex-wrap gap-2">
            {(["current", "company", "address"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setOriginType(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  originType === value
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {value === "current"
                  ? "Posizione attuale"
                  : value === "company"
                    ? "Azienda"
                    : "Indirizzo"}
              </button>
            ))}
          </div>
        </div>

        {originType === "company" && (
          <select
            value={originCompanyId}
            onChange={(event) => setOriginCompanyId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Seleziona partenza</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        )}

        {originType === "address" && (
          <div className="space-y-2">
            <input
              type="text"
              value={originAddressInput}
              onChange={(event) => setOriginAddressInput(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Indirizzo di partenza"
            />
            <button
              type="button"
              onClick={handleGeocodeOrigin}
              disabled={isPending || !originAddressInput.trim()}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Geocodifica partenza
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">Punto di arrivo</p>
          <div className="flex gap-2">
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
          <select
            value={destinationCompanyId}
            onChange={(event) => setDestinationCompanyId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Seleziona arrivo</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={destinationAddressInput}
              onChange={(event) => setDestinationAddressInput(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Indirizzo di arrivo"
            />
            <button
              type="button"
              onClick={handleGeocodeDestination}
              disabled={isPending || !destinationAddressInput.trim()}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Geocodifica arrivo
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-600">
          Durata max (min)
          <input
            type="number"
            min={60}
            max={960}
            value={constraints.maxDurationMinutes}
            onChange={(event) =>
              setConstraints((current) => ({
                ...current,
                maxDurationMinutes:
                  Number(event.target.value) || VISIT_TOUR_DEFAULT_MAX_DURATION_MIN,
              }))
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Visite max
          <input
            type="number"
            min={1}
            max={20}
            value={constraints.maxStops}
            onChange={(event) =>
              setConstraints((current) => ({
                ...current,
                maxStops: Number(event.target.value) || VISIT_TOUR_DEFAULT_MAX_STOPS,
              }))
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Deviazione max (km)
          <input
            type="number"
            min={1}
            max={50}
            step={0.5}
            value={constraints.maxDeviationKm}
            onChange={(event) =>
              setConstraints((current) => ({
                ...current,
                maxDeviationKm:
                  Number(event.target.value) || VISIT_TOUR_DEFAULT_MAX_DEVIATION_KM,
              }))
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => runOptimize(false)}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Ottimizza giro
        </button>
        <button
          type="button"
          onClick={() => runOptimize(true)}
          disabled={isPending || stops.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Ricalcola giro
        </button>
      </div>

      {origin && (
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Partenza: {originLabel}
        </p>
      )}

      {plan && (
        <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
          <p>Distanza totale: {formatDistanceKm(plan.totalDistanceKm)}</p>
          <p>Tempo stimato: {formatDurationMinutes(plan.estimatedMinutes)}</p>
          <p>Deviazione aggiunta: {formatDistanceKm(plan.totalDeviationKm)}</p>
        </div>
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

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">Tappe ({stops.length})</h4>
        <VisitTourStopsList
          stops={stops}
          onRemove={handleRemoveStop}
          onMoveUp={(companyId) => handleMoveStop(companyId, -1)}
          onMoveDown={(companyId) => handleMoveStop(companyId, 1)}
          onToggleLock={handleToggleLock}
        />
      </section>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-700">
          Aggiungi tappa manualmente
          <select
            value={manualCompanyId}
            onChange={(event) => setManualCompanyId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Seleziona azienda</option>
            {availableManualCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleAddManualStop}
          disabled={!manualCompanyId}
          className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Aggiungi tappa
        </button>
      </div>

      <label className="block text-xs font-medium text-slate-700">
        Note giro
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Note opzionali sul giro"
        />
      </label>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={handleSaveTour}
          disabled={isPending || !plan || stops.length === 0}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          Salva giro
        </button>

        {googleMapsTourUrl && (
          <a
            href={googleMapsTourUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <ExternalLink className="h-4 w-4" />
            Apri su Google Maps
          </a>
        )}
      </div>
    </aside>
  );
}
