"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { buildFullAddress } from "../utils/build-full-address";
import type { Company } from "../services/companies.service";

const CompanyDetailMapCanvas = dynamic(
  () => import("./company-detail-map-canvas").then((module) => module.CompanyDetailMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Caricamento mappa…
      </div>
    ),
  }
);

interface CompanyDetailMapTabProps {
  company: Company;
}

export function CompanyDetailMapTab({ company }: CompanyDetailMapTabProps) {
  const hasCoordinates = company.latitude != null && company.longitude != null;
  const fullAddress = buildFullAddress(company);
  const mapsUrl = hasCoordinates
    ? buildGoogleMapsDirectionsUrl(company.latitude!, company.longitude!)
    : fullAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      : null;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Posizione azienda</CardTitle>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <Button type="button" size="sm" variant="outline">
              <MapPin className="h-4 w-4" />
              Apri navigatore
            </Button>
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <p className="text-sm text-slate-600">
          {[company.address, company.city, company.province, company.postal_code]
            .filter(Boolean)
            .join(" · ") || "Indirizzo non disponibile."}
        </p>

        {hasCoordinates ? (
          <CompanyDetailMapCanvas
            latitude={company.latitude!}
            longitude={company.longitude!}
            companyName={company.name}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <MapPin className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Azienda non geolocalizzata</p>
            <p className="mt-1 text-xs text-slate-500">
              Correggi l&apos;indirizzo e attendi il geocoding per visualizzare la posizione sulla mappa.
            </p>
            <Link
              href={`/companies/${company.id}/edit`}
              className="mt-4 inline-flex text-sm font-medium text-indigo-600 hover:underline"
            >
              Modifica indirizzo
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
