"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Copy,
  FolderOpen,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { formatDurationMinutes } from "@/lib/last-visit/format";
import {
  deleteVisitTourAction,
  duplicateVisitTourAction,
  fetchVisitTourCompaniesByIdsAction,
  listVisitToursAction,
  loadVisitTourAction,
  renameVisitTourAction,
  updateVisitTourStatusAction,
} from "../actions/visit-tour-actions";
import { VISIT_TOUR_STATUS_LABELS } from "../constants/visit-tour-status";
import type {
  VisitTourListItem,
  VisitTourListSortKey,
  VisitTourLoadedState,
} from "../types/visit-tour";
import { buildGoogleMapsTourUrl } from "../utils/google-maps-tour-url";

interface VisitTourSavedListProps {
  agents: Array<{ id: string; label: string }>;
  onOpenTour: (tour: VisitTourLoadedState) => void;
}

function formatTourDate(value: string): string {
  if (!value.includes("-")) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function VisitTourSavedList({
  agents,
  onOpenTour,
}: VisitTourSavedListProps) {
  const [tours, setTours] = useState<VisitTourListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tourDateFilter, setTourDateFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [sortBy, setSortBy] = useState<VisitTourListSortKey>("date");
  const [sortAscending, setSortAscending] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadTours = useCallback(() => {
    startTransition(async () => {
      const result = await listVisitToursAction({
        tourDate: tourDateFilter || null,
        agentId: agentFilter || null,
        sortBy,
        sortAscending,
      });

      if (result.error) {
        setError(result.error);
        setTours([]);
        return;
      }

      setError(null);
      setTours(result.data);
    });
  }, [agentFilter, sortAscending, sortBy, tourDateFilter]);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const handleOpenTour = useCallback(
    (tourId: string) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await loadVisitTourAction(tourId);
        if (!result.success || !result.tour) {
          setError(result.message);
          return;
        }

        onOpenTour(result.tour);
        setMessage(result.message);
      });
    },
    [onOpenTour]
  );

  const handleCompleteTour = useCallback(
    (tourId: string) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await updateVisitTourStatusAction(tourId, "completed");
        if (!result.success) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        loadTours();
      });
    },
    [loadTours]
  );

  const handleStartTour = useCallback(
    (tourId: string) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await loadVisitTourAction(tourId);
        if (!result.success || !result.tour) {
          setError(result.message);
          return;
        }

        const waypoints = result.tour.stops
          .map((stop) => {
            const lat = stop.company.latitude;
            const lng = stop.company.longitude;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }
            return { lat, lng };
          })
          .filter((point): point is { lat: number; lng: number } => point !== null);

        if (waypoints.length === 0) {
          const ids = result.tour.stops.map((stop) => stop.id);
          const companiesResult = await fetchVisitTourCompaniesByIdsAction(ids);
          if (companiesResult.error || companiesResult.data.length === 0) {
            setError("Nessuna tappa con coordinate disponibile per avviare il giro.");
            return;
          }

          const companyById = new Map(companiesResult.data.map((company) => [company.id, company]));
          const resolvedWaypoints = result.tour.stops
            .map((stop) => {
              const company = companyById.get(stop.id);
              if (!company) {
                return null;
              }
              return { lat: company.latitude, lng: company.longitude };
            })
            .filter((point): point is { lat: number; lng: number } => point !== null);

          if (resolvedWaypoints.length === 0) {
            setError("Nessuna tappa con coordinate disponibile per avviare il giro.");
            return;
          }

          const url = buildGoogleMapsTourUrl(
            result.tour.origin,
            result.tour.destination.point,
            resolvedWaypoints
          );
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        }

        const url = buildGoogleMapsTourUrl(
          result.tour.origin,
          result.tour.destination.point,
          waypoints
        );
        window.open(url, "_blank", "noopener,noreferrer");
      });
    },
    []
  );

  const handleStartInProgress = useCallback(
    (tourId: string) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await updateVisitTourStatusAction(tourId, "in_progress");
        if (!result.success) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        loadTours();
        handleStartTour(tourId);
      });
    },
    [handleStartTour, loadTours]
  );

  const handleDuplicate = useCallback(
    (tourId: string) => {
      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await duplicateVisitTourAction(tourId);
        if (!result.success) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        loadTours();
      });
    },
    [loadTours]
  );

  const handleDelete = useCallback(
    (tour: VisitTourListItem) => {
      if (
        !window.confirm(
          `Eliminare il giro "${tour.name}" del ${formatTourDate(tour.tourDate)}?`
        )
      ) {
        return;
      }

      setMessage(null);
      setError(null);

      startTransition(async () => {
        const result = await deleteVisitTourAction(tour.id);
        if (!result.success) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        loadTours();
      });
    },
    [loadTours]
  );

  const handleStartRename = useCallback((tour: VisitTourListItem) => {
    setRenamingId(tour.id);
    setRenameValue(tour.name);
    setMessage(null);
    setError(null);
  }, []);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
  }, []);

  const handleSaveRename = useCallback(
    (tourId: string) => {
      const trimmed = renameValue.trim();
      if (!trimmed) {
        setError("Inserisci un nome per il giro.");
        return;
      }

      startTransition(async () => {
        const result = await renameVisitTourAction(tourId, trimmed);
        if (!result.success) {
          setError(result.message);
          return;
        }

        setRenamingId(null);
        setRenameValue("");
        setMessage(result.message);
        loadTours();
      });
    },
    [loadTours, renameValue]
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Giri salvati</h3>
          <p className="mt-1 text-xs text-slate-500">
            Riapri, duplica o avvia i giri visite salvati in precedenza.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTours}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Aggiorna
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-xs text-slate-600">
          Data giro
          <input
            type="date"
            value={tourDateFilter}
            onChange={(event) => setTourDateFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-xs text-slate-600">
          Agente
          <select
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Tutti gli agenti</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-600">
          Ordina per
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as VisitTourListSortKey)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="date">Data</option>
            <option value="name">Nome</option>
          </select>
        </label>

        <label className="block text-xs text-slate-600">
          Direzione
          <select
            value={sortAscending ? "asc" : "desc"}
            onChange={(event) => setSortAscending(event.target.value === "asc")}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {message && !error && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {tours.length === 0 && !isPending ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Nessun giro salvato trovato con i filtri selezionati.
        </p>
      ) : (
        <ul className="space-y-3">
          {tours.map((tour) => (
            <li
              key={tour.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  {renamingId === tour.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRename(tour.id)}
                          disabled={isPending}
                          className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          disabled={isPending}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{tour.name}</h4>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {VISIT_TOUR_STATUS_LABELS[tour.status]}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartRename(tour)}
                        disabled={isPending}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                        title="Rinomina"
                      >
                        <Pencil className="h-3 w-3" />
                        Rinomina
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatTourDate(tour.tourDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {tour.agentLabel}
                    </span>
                    <span>{tour.stopCount} tappe</span>
                    {tour.totalDistanceKm != null && (
                      <span>{formatDistanceKm(tour.totalDistanceKm)}</span>
                    )}
                    {tour.estimatedMinutes != null && (
                      <span>{formatDurationMinutes(tour.estimatedMinutes)}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {tour.originLabel} → {tour.destinationLabel}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTour(tour.id)}
                    disabled={isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Apri
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartInProgress(tour.id)}
                    disabled={isPending || tour.status === "completed"}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Avvia
                  </button>
                  {tour.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => handleCompleteTour(tour.id)}
                      disabled={isPending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Completa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(tour.id)}
                    disabled={isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplica
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tour)}
                    disabled={isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isPending && tours.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento giri salvati…
        </div>
      )}
    </section>
  );
}
