import { Suspense } from "react";
import Link from "next/link";
import { Building2, ShoppingCart } from "lucide-react";
import { EmptyState, PageHeader, PageLoadingSkeleton } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseOrderFilters } from "@/lib/constants/orders";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { OrderFiltersBar } from "./components/order-filters-bar";
import { JoyAiPageLink } from "@/features/joy/components/joy-ai-page-link";
import { OrdersList } from "./components/orders-list";
import { listOrderFilterOptions, listOrders } from "./services/orders.service";

interface OrdersPageProps {
  company?: string;
  agent?: string;
  from?: string;
  to?: string;
}

export async function OrdersPage({ company, agent, from, to }: OrdersPageProps) {
  const filters = parseOrderFilters({ company, agent, from, to });

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ordini" subtitle="Gestione ordini commerciali." />
        <EmptyState
          icon={ShoppingCart}
          title="Database non configurato"
          message="Configura Supabase in .env.local per gestire gli ordini."
        />
      </div>
    );
  }

  const [ordersResult, filterOptionsResult] = await Promise.all([
    listOrders({ filters }),
    listOrderFilterOptions(),
  ]);

  const { data: orders, count, error } = ordersResult;
  const filterOptions = filterOptionsResult.data ?? { agents: [], companies: [] };
  const totalValue = orders.reduce(
    (sum, item) => sum + (Number.isFinite(item.total_amount) ? item.total_amount : 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordini"
        subtitle={`${count.toLocaleString("it-IT")} ordini · ${formatOpportunityAmount(totalValue)} totali`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <JoyAiPageLink prompt="Mostrami gli ordini" />
            <Link
              href="/ordini/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <ShoppingCart className="h-4 w-4" />
              Nuovo ordine
            </Link>
            <Link
              href="/companies"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Building2 className="h-4 w-4" />
              Da azienda
            </Link>
          </div>
        }
      />

      <Suspense fallback={<PageLoadingSkeleton rows={1} />}>
        <OrderFiltersBar
          agents={filterOptions.agents}
          companies={filterOptions.companies}
        />
      </Suspense>

      {error ? (
        <EmptyState icon={ShoppingCart} title="Impossibile caricare gli ordini" message={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nessun ordine"
          message="Gli ordini corrispondono alle opportunità vinte in pipeline. Chiudi un'opportunità come Vinta oppure reimposta i filtri."
        />
      ) : (
        <OrdersList items={orders} />
      )}
    </div>
  );
}
