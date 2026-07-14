import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  INTEREST_LEVEL_LABELS,
  PRODUCT_FAMILY_LABELS,
} from "@/lib/constants/product-catalog";
import { listCompanyProductInterests } from "@/features/products/services/company-product-interests.service";
import type { OpportunityListItem } from "../services/opportunities.service";

interface OpportunityRelatedProductsSectionProps {
  opportunity: OpportunityListItem;
}

export async function OpportunityRelatedProductsSection({
  opportunity,
}: OpportunityRelatedProductsSectionProps) {
  const { data: interests, error } = await listCompanyProductInterests(opportunity.company_id);

  const linkedProducts = opportunity.product_names;
  const relatedInterests = interests.filter(
    (item) =>
      opportunity.product_ids.includes(item.product_id) ||
      item.product_family === opportunity.product_family
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prodotti di interesse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {error && <p className="text-sm text-rose-700">{error}</p>}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Collegati all&apos;opportunità
          </p>
          {linkedProducts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              {PRODUCT_FAMILY_LABELS[opportunity.product_family]}
              {opportunity.product_interest ? ` · ${opportunity.product_interest}` : ""}
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {linkedProducts.map((name) => (
                <li key={name}>
                  <Badge variant="info">{name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Interessi azienda correlati
          </p>
          {relatedInterests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Nessun interesse prodotto registrato per questa famiglia.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {relatedInterests.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {PRODUCT_FAMILY_LABELS[item.product_family]}
                      {item.interest_level
                        ? ` · ${INTEREST_LEVEL_LABELS[item.interest_level]}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/companies/${opportunity.company_id}`}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Scheda azienda
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
