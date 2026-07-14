"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
} from "lucide-react";
import {
  confirmGeocodePositionAction,
  regeocodeCompanyAction,
} from "../actions/geocode-review-actions";
import type { CompanyNeedingReview } from "../types/geocoding";

interface GeocodingReviewItemProps {
  company: CompanyNeedingReview;
}

function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) {
    return "—";
  }

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function buildGoogleMapsUrl(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function GeocodingReviewItem({ company }: GeocodingReviewItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState({
    address: company.address ?? "",
    street: company.street ?? "",
    street_number: company.street_number ?? "",
    postal_code: company.postal_code ?? "",
    city: company.city ?? "",
    province: company.province ?? "",
    country: company.country ?? "IT",
  });

  const mapsUrl = buildGoogleMapsUrl(company.latitude, company.longitude);

  function handleConfirm() {
    setMessage(null);
    setIsError(false);

    startTransition(async () => {
      const result = await confirmGeocodePositionAction(company.id);
      setMessage(result.message);
      setIsError(!result.success);

      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleRegeocode() {
    setMessage(null);
    setIsError(false);

    startTransition(async () => {
      const result = await regeocodeCompanyAction(company.id, form);
      setMessage(result.message);
      setIsError(!result.success);

      if (result.success) {
        setShowForm(false);
        router.refresh();
      }
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{company.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {company.city || "—"}
            {company.province ? ` (${company.province})` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              Apri su Google Maps
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-400"
            >
              <ExternalLink className="h-4 w-4" />
              Apri su Google Maps
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !mapsUrl}
            title={
              mapsUrl
                ? undefined
                : "Coordinate mancanti: correggi l'indirizzo e rigeocodifica prima di confermare."
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Conferma posizione
          </button>

          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
            Correggi indirizzo
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Indirizzo originale
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{company.originalAddress || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Indirizzo normalizzato
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {company.geocoding_normalized_address || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Comune
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{company.city || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Provincia
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{company.province || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Coordinate trovate
          </dt>
          <dd className="mt-1 inline-flex items-center gap-1 text-sm text-slate-800">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {formatCoordinates(company.latitude, company.longitude)}
          </dd>
        </div>
      </dl>

      {showForm && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">Correggi indirizzo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Indirizzo</span>
              <input
                type="text"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Via</span>
              <input
                type="text"
                value={form.street}
                onChange={(event) => setForm({ ...form, street: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Civico</span>
              <input
                type="text"
                value={form.street_number}
                onChange={(event) => setForm({ ...form, street_number: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">CAP</span>
              <input
                type="text"
                value={form.postal_code}
                onChange={(event) => setForm({ ...form, postal_code: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Comune</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Provincia</span>
              <input
                type="text"
                value={form.province}
                onChange={(event) => setForm({ ...form, province: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-600">Nazione</span>
              <input
                type="text"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegeocode}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Rigeocodifica indirizzo
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            isError
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </p>
      )}
    </article>
  );
}
