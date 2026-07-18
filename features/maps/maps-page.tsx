import { Building2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { listBrands } from "@/features/brands/services/brands.service";
import { CompaniesMapClient } from "./components/companies-map-client";
import { getMapPageBootstrap } from "./services/map-companies.service";

export async function MapsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mappa" subtitle="Visualizza le aziende geolocalizzate." />
        <EmptyState
          icon={Building2}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
        />
      </div>
    );
  }

  const [{ stats, provinces, error }, brandsResult] = await Promise.all([
    getMapPageBootstrap(),
    listBrands({ activeOnly: true }),
  ]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mappa" subtitle="Visualizza le aziende geolocalizzate." />
        <EmptyState icon={Building2} title="Impossibile caricare la mappa" message={error} />
      </div>
    );
  }

  const brands = (brandsResult.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    color: b.color,
  }));

  return <CompaniesMapClient provinces={provinces} stats={stats} brands={brands} />;
}
