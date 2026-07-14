"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, MapPin, MapPinOff } from "lucide-react";
import { geocodeCompaniesAction } from "../actions/geocode-companies";
import type { GeocodingSummary, GeoapifyConfigView } from "../types/geocoding";
import { DEFAULT_GEOAPIFY_CONFIG } from "../types/geocoding";

interface GeocodingPanelProps {
  summary: GeocodingSummary;
  geoapifyConfig?: GeoapifyConfigView;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof MapPin;
  tone: "slate" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString("it-IT")}
      </p>
    </div>
  );
}

export function GeocodingPanel({ summary, geoapifyConfig }: GeocodingPanelProps) {
  const { configured: geoapifyConfigured, label: geoapifyConfigLabel } =
    geoapifyConfig ?? DEFAULT_GEOAPIFY_CONFIG;
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGeocode() {
    setMessage(null);
    setIsError(false);

    startTransition(async () => {
      const result = await geocodeCompaniesAction();
      setMessage(result.message);
      setIsError(!result.success);

      if (result.processed > 0) {
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Geolocalizzazione</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                geoapifyConfigured
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {geoapifyConfigured ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {geoapifyConfigLabel}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Riepilogo stato geocoding aziende (Geoapify).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/companies/geocoding/review"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
          >
            <ExternalLink className="h-4 w-4" />
            Visualizza aziende da verificare
          </Link>

          <button
            type="button"
            onClick={handleGeocode}
            disabled={!geoapifyConfigured || isPending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Geolocalizza aziende
          </button>
        </div>
      </div>

      {!geoapifyConfigured && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Aggiungi GEOAPIFY_API_KEY in .env.local (root del progetto) e riavvia il server di sviluppo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Senza coordinate"
          value={summary.withoutCoordinates}
          icon={MapPinOff}
          tone="slate"
        />
        <SummaryCard
          label="Geolocalizzate"
          value={summary.geocoded}
          icon={MapPin}
          tone="emerald"
        />
        <SummaryCard
          label="Da verificare"
          value={summary.needsReview}
          icon={AlertCircle}
          tone="amber"
        />
        <SummaryCard
          label="Fallite"
          value={summary.failed}
          icon={AlertCircle}
          tone="rose"
        />
      </div>

      {message && (
        <p
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            isError
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {isError ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {message}
        </p>
      )}
    </section>
  );
}
