"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Loader2, Map, Navigation } from "lucide-react";
import { Button } from "@/components/ui";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "@/features/maps/constants/map-config";
import type { CommercialStatus } from "@/lib/supabase/types";
import type { QuickMapData } from "../../types/intelligent-dashboard";
import { DashboardWidgetShell } from "./dashboard-widget-shell";

const QuickMapCanvas = dynamic(
  () => import("./quick-map-canvas").then((module) => module.QuickMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Caricamento mappa…
      </div>
    ),
  }
);

interface QuickMapWidgetProps {
  data: QuickMapData;
}

interface UserCoords {
  lat: number;
  lng: number;
}

export function QuickMapWidget({ data }: QuickMapWidgetProps) {
  const [userLocation, setUserLocation] = useState<UserCoords | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocalizzazione non supportata.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setLocationError("Posizione non disponibile.");
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 }
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      requestLocation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  const mapCenter = userLocation ?? data.defaultCenter;

  const nearbyCompanies = useMemo(() => {
    if (!userLocation) {
      return data.companies.slice(0, 15);
    }

    return [...data.companies]
      .map((company) => {
        const dLat = ((company.latitude - userLocation.lat) * Math.PI) / 180;
        const dLng = ((company.longitude - userLocation.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((userLocation.lat * Math.PI) / 180) *
            Math.cos((company.latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { company, distanceKm };
      })
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 15)
      .map((entry) => entry.company);
  }, [data.companies, userLocation]);

  return (
    <DashboardWidgetShell
      title="Mappa veloce"
      icon={<Map className="h-4 w-4 text-emerald-600" />}
      action={
        <Link href="/maps">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Apri Mappa
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
      contentClassName="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={isLocating}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5" />
          )}
          {userLocation ? "Aggiorna posizione" : "Usa la mia posizione"}
        </button>
        {locationError ? (
          <span className="text-xs text-slate-500">{locationError}</span>
        ) : null}
        <span className="text-xs text-slate-500">
          {nearbyCompanies.length} aziende in vista
        </span>
      </div>

      <QuickMapCanvas
        center={mapCenter}
        userLocation={userLocation}
        companies={nearbyCompanies}
        markerColors={COMMERCIAL_STATUS_MARKER_COLORS}
      />

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        {(["prospect", "cliente", "da_ricontattare"] as CommercialStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COMMERCIAL_STATUS_MARKER_COLORS[status] }}
            />
            {status.replace("_", " ")}
          </span>
        ))}
      </div>
    </DashboardWidgetShell>
  );
}
