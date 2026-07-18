"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Navigation,
  Phone,
  Radar,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { PriorityBadge } from "@/features/companies/components/priority-badge";
import { NEARBY_RADIUS_OPTIONS_KM } from "@/features/maps/constants/map-config";
import type { NearbyRadiusKm } from "@/features/maps/constants/map-config";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { analyzeOpportunityRadarAction } from "../actions/opportunity-radar-action";
import type { OpportunityRadarItem, RadarCompanySource } from "../types";
import { collectRadarCompanyIds } from "../utils/filter-radar-companies";
import { getValidMapCoordinates } from "../utils/map-coordinates";
import { cn } from "@/utils/cn";

interface OpportunityRadarPanelProps {
  companies: RadarCompanySource[];
  center: { lat: number; lng: number } | null;
  isLocating?: boolean;
  locationError?: string | null;
  onRequestLocation?: () => void;
  layout?: "sidebar" | "overlay";
  className?: string;
}

function formatOpportunityValue(value: number): string {
  if (value <= 0) {
    return "—";
  }
  return `€${Math.round(value).toLocaleString("it-IT")}`;
}

function RadarResultCard({ item, rank }: { item: OpportunityRadarItem; rank: number }) {
  const phoneHref = item.phone ? `tel:${item.phone.replace(/\s+/g, "")}` : null;
  const mapCoords = getValidMapCoordinates(item.latitude, item.longitude);

  return (
    <li className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-slate-500">#{rank}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{item.companyName}</p>
          <p className="text-xs text-slate-600">
            {[item.city, item.province].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <PriorityBadge score={item.score} tier={item.tier} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
        <div>
          <span className="text-slate-500">📍 Distanza</span>
          <p className="font-medium">{formatDistanceKm(item.distanceKm)}</p>
        </div>
        <div>
          <span className="text-slate-500">💰 Opportunità</span>
          <p className="font-medium">{formatOpportunityValue(item.opportunityValue)}</p>
        </div>
        <div>
          <span className="text-slate-500">📅 Ultima visita</span>
          <p className="font-medium">{item.lastVisitLabel}</p>
        </div>
        <div>
          <span className="text-slate-500">⭐ Punteggio</span>
          <p className="font-medium">{item.score}/100</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
        <p className="text-xs font-medium text-amber-900">🔥 {item.primaryReason}</p>
        {item.reasons.length > 1 ? (
          <p className="mt-1 text-[11px] text-amber-800">{item.reasons.slice(1).join(" · ")}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {mapCoords ? (
          <a
            href={buildGoogleMapsDirectionsUrl(mapCoords.latitude, mapCoords.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Navigation className="h-3.5 w-3.5" />
            Naviga
          </a>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 text-xs text-slate-400">
            <Navigation className="h-3.5 w-3.5" />
            Naviga
          </span>
        )}
        {phoneHref ? (
          <a
            href={phoneHref}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Phone className="h-3.5 w-3.5" />
            Chiama
          </a>
        ) : null}
        <Link
          href={`/visits?company=${item.companyId}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Pianifica
        </Link>
        <Link
          href={`/assistant?briefing=${item.companyId}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <FileText className="h-3.5 w-3.5" />
          Briefing AI
        </Link>
        <Link
          href={`/companies/${item.companyId}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Building2 className="h-3.5 w-3.5" />
          Scheda
        </Link>
      </div>
    </li>
  );
}

function RadarPanelContent({
  companies,
  center,
  isLocating = false,
  locationError = null,
  onRequestLocation,
}: OpportunityRadarPanelProps) {
  const [radiusKm, setRadiusKm] = useState<NearbyRadiusKm>(5);
  const [items, setItems] = useState<OpportunityRadarItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const companyIds = useMemo(() => {
    if (!center) {
      return [];
    }
    return collectRadarCompanyIds(companies, center, radiusKm);
  }, [center, companies, radiusKm]);

  const canAnalyze = Boolean(center && companyIds.length > 0);
  const visibleItems = canAnalyze ? items : [];
  const visibleError = canAnalyze ? error : null;

  useEffect(() => {
    if (!center || companyIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await analyzeOpportunityRadarAction({
          centerLat: center.lat,
          centerLng: center.lng,
          radiusKm,
          companyIds,
        });

        if (result.error) {
          setError(result.error);
          setItems([]);
          return;
        }

        setError(null);
        setItems(result.items);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [center, companyIds, radiusKm]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Radar Opportunità</h3>
            <Badge variant="info" className="text-[10px]">
              Auto
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {center
              ? `${visibleItems.length.toLocaleString("it-IT")} suggerimenti su ${companyIds.length.toLocaleString("it-IT")} prospect/clienti nel raggio`
              : "In attesa della posizione per analizzare il territorio"}
          </p>
        </div>
        {onRequestLocation ? (
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={isLocating}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Aggiorna posizione"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            Posizione
          </button>
        ) : null}
      </div>

      {locationError ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {locationError}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Raggio di analisi</span>
        <select
          value={radiusKm}
          onChange={(event) => setRadiusKm(Number(event.target.value) as NearbyRadiusKm)}
          className="field-input w-full rounded-lg border border-slate-200 px-3 py-2"
          disabled={!center}
        >
          {NEARBY_RADIUS_OPTIONS_KM.map((radius) => (
            <option key={radius} value={radius}>
              {radius} km
            </option>
          ))}
        </select>
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100">
        {!center ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-500">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <p>Consenti la geolocalizzazione per avviare il radar opportunità.</p>
          </div>
        ) : isPending && visibleItems.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            Analisi in corso...
          </div>
        ) : visibleError ? (
          <div className="p-4 text-center text-sm text-rose-700">{visibleError}</div>
        ) : companyIds.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            Nessun prospect o cliente geolocalizzato nel raggio selezionato.
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            Nessuna visita suggerita con i criteri attuali.
          </div>
        ) : (
          <ul className="space-y-3 p-3">
            {visibleItems.map((item, index) => (
              <RadarResultCard key={item.companyId} item={item} rank={index + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function OpportunityRadarPanel({
  companies,
  center,
  isLocating,
  locationError,
  onRequestLocation,
  layout = "sidebar",
  className,
}: OpportunityRadarPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(true);

  if (layout === "overlay") {
    return (
      <>
        <aside
          className={cn(
            "hidden w-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:flex xl:max-h-[calc(100vh-14rem)]",
            className
          )}
        >
          <RadarPanelContent
            companies={companies}
            center={center}
            isLocating={isLocating}
            locationError={locationError}
            onRequestLocation={onRequestLocation}
          />
        </aside>

        <div className="fixed inset-x-0 bottom-14 z-30 lg:hidden">
          <div className="mx-2 overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileExpanded((value) => !value)}
              className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Radar className="h-4 w-4 text-indigo-600" />
                Radar Opportunità
              </span>
              {mobileExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              )}
            </button>
            {mobileExpanded ? (
              <div className="max-h-[58vh] overflow-y-auto border-t border-slate-100 p-4">
                <RadarPanelContent
                  companies={companies}
                  center={center}
                  isLocating={isLocating}
                  locationError={locationError}
                  onRequestLocation={onRequestLocation}
                />
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "flex max-h-[420px] w-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:max-h-none lg:flex-1",
        className
      )}
    >
      <RadarPanelContent
        companies={companies}
        center={center}
        isLocating={isLocating}
        locationError={locationError}
        onRequestLocation={onRequestLocation}
      />
    </aside>
  );
}
