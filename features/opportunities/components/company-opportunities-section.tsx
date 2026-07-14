import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  formatOpportunityAmount,
  isOpenOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { listProducts } from "@/features/products/services/products.service";
import { NewOpportunityForm } from "./new-opportunity-form";
import { getCompanyOpportunitySummary } from "../services/opportunities.service";

interface CompanyOpportunitiesSectionProps {
  companyId: string;
  contacts: ContactListItem[];
}

export async function CompanyOpportunitiesSection({
  companyId,
  contacts,
}: CompanyOpportunitiesSectionProps) {
  const [{ data: summary, error }, productsResult] = await Promise.all([
    getCompanyOpportunitySummary(companyId),
    listProducts({ activeOnly: true }),
  ]);
  const openItems = summary.items.filter((item) => isOpenOpportunityStage(item.stage));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Opportunità commerciali</CardTitle>
        <NewOpportunityForm
          companyId={companyId}
          contacts={contacts}
          products={productsResult.data}
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {error && <p className="text-sm text-rose-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Aperte</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.openCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valore totale</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatOpportunityAmount(summary.totalValue)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Probabilità media</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.averageProbability}%</p>
          </div>
        </div>

        {openItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Nessuna opportunità aperta per questa azienda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {openItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {PRODUCT_FAMILY_LABELS[item.product_family]}
                    {item.product_names.length > 0 ? ` · ${item.product_names.join(", ")}` : ""} ·{" "}
                    {formatOpportunityAmount(item.total_amount, item.currency)} · {item.probability ?? 0}%
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="info">{OPPORTUNITY_STAGE_LABELS[item.stage]}</Badge>
                    {item.contact_name && <Badge variant="muted">{item.contact_name}</Badge>}
                  </div>
                </div>
                <Link
                  href={`/opportunities/${item.id}`}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Apri scheda
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
