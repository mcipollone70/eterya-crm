"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Car } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { formatDistanceKm, getDistanceKm } from "@/features/maps/utils/geo-distance";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import type { VisitCompanyOption } from "@/features/visits/services/visits.service";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { AutoModeAppointment } from "../types/auto-mode";
import { AutoModeCompletionSheet } from "./auto-mode-completion-sheet";
import { AutoModeRecordSheet } from "./auto-mode-record-sheet";

interface AutoModeScreenProps {
  appointment: AutoModeAppointment | null;
  calendar: GoogleCalendarConnectionView;
  companies: VisitCompanyOption[];
}

function calendarStatusLabel(calendar: GoogleCalendarConnectionView): string {
  if (!calendar.configured) {
    return "Google Calendar non configurato";
  }
  if (!calendar.connected) {
    return "Google Calendar non collegato";
  }
  if (calendar.needsReconnect) {
    return "Riconnessione richiesta";
  }
  return calendar.googleEmail ? `Sincronizzato · ${calendar.googleEmail}` : "Google Calendar attivo";
}

function calendarStatusVariant(
  calendar: GoogleCalendarConnectionView
): "success" | "warning" | "danger" | "muted" {
  if (!calendar.configured || !calendar.connected) {
    return "muted";
  }
  if (calendar.needsReconnect || calendar.lastSyncError) {
    return "danger";
  }
  return "success";
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

interface AutoActionButtonProps {
  emoji: string;
  label: string;
  tone: string;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
}

function AutoActionButton({ emoji, label, tone, href, disabled, onClick }: AutoActionButtonProps) {
  const className = `touch-target flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-5 text-center text-lg font-bold shadow-sm transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-28 sm:text-xl ${tone}`;

  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <span className="text-3xl sm:text-4xl" aria-hidden>
          {emoji}
        </span>
        {label}
      </a>
    );
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      <span className="text-3xl sm:text-4xl" aria-hidden>
        {emoji}
      </span>
      {label}
    </button>
  );
}

export function AutoModeScreen({ appointment, calendar, companies }: AutoModeScreenProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingNotes, setPendingNotes] = useState("");
  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);

  useEffect(() => {
    requestUserLocation(setUserLocation);
  }, []);

  useEffect(() => {
    setPendingNotes(appointment?.notes ?? "");
  }, [appointment?.visitId, appointment?.notes]);

  const distanceLabel = useMemo(() => {
    if (!appointment?.latitude || !appointment?.longitude || !userLocation) {
      return "—";
    }

    const distanceKm = getDistanceKm(
      userLocation.lat,
      userLocation.lng,
      appointment.latitude,
      appointment.longitude
    );
    return formatDistanceKm(distanceKm);
  }, [appointment, userLocation]);

  const navigateHref =
    appointment?.latitude != null && appointment?.longitude != null
      ? buildGoogleMapsDirectionsUrl(appointment.latitude, appointment.longitude)
      : undefined;

  const phoneHref = appointment?.phone
    ? `tel:${appointment.phone.replace(/\s+/g, "")}`
    : undefined;

  const handleCompleted = useCallback(() => {
    setShowCompletionSheet(false);
    setPendingNotes("");
  }, []);

  if (!appointment) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Car className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Modalità Auto</h1>
              <p className="text-base text-slate-600 sm:text-lg">Nessun appuntamento in programma oggi</p>
            </div>
          </div>
        </header>
        <EmptyState
          icon={CalendarDays}
          title="Nessuna visita pianificata"
          message="Pianifica un appuntamento dall'agenda o dalla pagina Visite per usarlo in modalità auto."
        />
        <Link
          href="/agenda"
          className="touch-target inline-flex min-h-16 items-center justify-center rounded-2xl bg-indigo-600 px-6 text-lg font-semibold text-white hover:bg-indigo-700"
        >
          Apri agenda
        </Link>
      </div>
    );
  }

  const cityLabel = [appointment.city, appointment.province].filter(Boolean).join(" · ") || "—";

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-6 sm:gap-6">
        <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Car className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
                  Modalità Auto
                </p>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Prossimo appuntamento</h1>
              </div>
            </div>
            <Badge variant={calendarStatusVariant(calendar)}>
              <CalendarDays className="mr-1 h-4 w-4" />
              {calendarStatusLabel(calendar)}
            </Badge>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <p className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
            {appointment.companyName}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Orario</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                {appointment.scheduledLabel}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Distanza</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{distanceLabel}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-1">
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Comune</p>
              <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{cityLabel}</p>
            </div>
          </div>
          {appointment.notes || pendingNotes ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-base text-amber-900">
              {pendingNotes || appointment.notes}
            </p>
          ) : null}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          <AutoActionButton
            emoji="🧭"
            label="Naviga"
            tone="border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
            href={navigateHref}
            disabled={!navigateHref}
          />
          <AutoActionButton
            emoji="📞"
            label="Chiama"
            tone="border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
            href={phoneHref}
            disabled={!phoneHref}
          />
          <AutoActionButton
            emoji="🎤"
            label="Registra visita"
            tone="border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
            onClick={() => setShowRecordSheet(true)}
          />
          <AutoActionButton
            emoji="✅"
            label="Fine visita"
            tone="border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={() => setShowCompletionSheet(true)}
          />
        </section>

        <p className="text-center text-sm text-slate-500">
          Interfaccia ottimizzata per touch · tablet e smartphone
        </p>
      </div>

      {showRecordSheet ? (
        <AutoModeRecordSheet
          visitId={appointment.visitId}
          companyId={appointment.companyId}
          companyName={appointment.companyName}
          initialNotes={pendingNotes || appointment.notes}
          onClose={() => setShowRecordSheet(false)}
          onSaved={setPendingNotes}
        />
      ) : null}

      {showCompletionSheet ? (
        <AutoModeCompletionSheet
          appointment={appointment}
          companies={companies}
          pendingNotes={pendingNotes}
          userLocation={userLocation}
          onClose={() => setShowCompletionSheet(false)}
          onCompleted={handleCompleted}
        />
      ) : null}
    </>
  );
}
