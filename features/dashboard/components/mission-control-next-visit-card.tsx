"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDistanceKm, getDistanceKm } from "@/features/maps/utils/geo-distance";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import type { MissionControlNextVisit } from "../types/mission-control";

interface MissionControlNextVisitCardProps {
  nextVisit: MissionControlNextVisit;
}

function requestUserLocation(
  onSuccess: (location: { lat: number; lng: number }) => void
): void {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    () => undefined,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
  );
}

export function MissionControlNextVisitCard({ nextVisit }: MissionControlNextVisitCardProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    requestUserLocation(setUserLocation);
  }, []);

  const distanceLabel = useMemo(() => {
    if (
      !userLocation ||
      nextVisit.latitude == null ||
      nextVisit.longitude == null
    ) {
      return "—";
    }

    return formatDistanceKm(
      getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        nextVisit.latitude,
        nextVisit.longitude
      )
    );
  }, [nextVisit.latitude, nextVisit.longitude, userLocation]);

  const phoneHref = nextVisit.phone ? `tel:${nextVisit.phone.replace(/\s+/g, "")}` : null;
  const navigateHref =
    nextVisit.latitude != null && nextVisit.longitude != null
      ? buildGoogleMapsDirectionsUrl(nextVisit.latitude, nextVisit.longitude)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl">{nextVisit.companyName}</CardTitle>
        <p className="text-sm text-slate-500">
          {nextVisit.scheduledDayLabel} alle {nextVisit.scheduledLabel} · Distanza {distanceLabel}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-medium text-slate-500">Orario: </span>
            {nextVisit.scheduledLabel}
          </p>
          <p>
            <span className="font-medium text-slate-500">Telefono: </span>
            {nextVisit.phone ?? "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {navigateHref ? (
            <a
              href={navigateHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-900 hover:bg-sky-100 sm:text-sm"
            >
              <Navigation className="h-4 w-4" />
              Naviga
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 sm:text-sm">
              Naviga
            </span>
          )}
          {phoneHref ? (
            <a
              href={phoneHref}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 sm:text-sm"
            >
              <Phone className="h-4 w-4" />
              Chiama
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 sm:text-sm">
              Chiama
            </span>
          )}
          <Link
            href={`/visits?company=${nextVisit.companyId}&briefing=${nextVisit.companyId}`}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 sm:text-sm"
          >
            <Sparkles className="h-4 w-4" />
            Briefing
          </Link>
          <Link
            href={companyRegisterVisitHref(nextVisit.companyId)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 sm:text-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            Registra visita
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
