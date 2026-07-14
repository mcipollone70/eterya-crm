import Link from "next/link";
import { AlertCircle, ArrowLeft, Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listCompaniesNeedingReview } from "../services/company-geocoding.service";
import { GeocodingReviewItem } from "./geocoding-review-item";

export async function GeocodingReviewPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Aziende da verificare"
          subtitle="Revisione geolocalizzazioni con precisione bassa o indirizzo ambiguo."
        />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
        />
      </div>
    );
  }

  const { data: companies, error } = await listCompaniesNeedingReview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aziende da verificare"
        subtitle={`${companies.length.toLocaleString("it-IT")} aziende con geocodifica da verificare.`}
        actions={
          <Link
            href="/companies"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna alle aziende
          </Link>
        }
      />

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {!error && companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nessuna azienda da verificare"
          message="Tutte le geolocalizzazioni sono state confermate o non richiedono revisione."
          action={
            <Link
              href="/companies"
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Torna alle aziende
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <GeocodingReviewItem key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
