import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  INTEREST_LEVEL_LABELS,
  PRODUCT_FAMILY_LABELS,
} from "@/lib/constants/product-catalog";
import { listProducts } from "../services/products.service";
import {
  listCompanyProductInterests,
  listCompanyProductInterestHistory,
} from "../services/company-product-interests.service";
import { AddCompanyProductForm } from "./add-company-product-form";

interface CompanyProductsSectionProps {
  companyId: string;
}

export async function CompanyProductsSection({ companyId }: CompanyProductsSectionProps) {
  const [productsResult, interestsResult, historyResult] = await Promise.all([
    listProducts({ activeOnly: true }),
    listCompanyProductInterests(companyId),
    listCompanyProductInterestHistory(companyId, 30),
  ]);

  const products = productsResult.data;
  const interests = interestsResult.data;
  const history = historyResult.data;
  const error = interestsResult.error ?? historyResult.error ?? productsResult.error;

  const interestItems = interests.filter((item) => item.relation_type === "interest");
  const purchasedItems = interests.filter((item) => item.relation_type === "purchased");

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Prodotti di interesse</CardTitle>
        <AddCompanyProductForm companyId={companyId} products={products} />
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        {error && <p className="text-sm text-rose-700">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Interessi attivi</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{interestItems.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prodotti acquistati</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{purchasedItems.length}</p>
          </div>
        </div>

        {interestItems.length === 0 && purchasedItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Nessun prodotto collegato a questa azienda.
          </p>
        ) : (
          <div className="space-y-4">
            {interestItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Interessi commerciali</h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {interestItems.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {PRODUCT_FAMILY_LABELS[item.product_family]}
                            {item.last_interest_at
                              ? ` · ultimo interesse ${new Date(item.last_interest_at).toLocaleDateString("it-IT")}`
                              : ""}
                          </p>
                          {item.commercial_notes && (
                            <p className="mt-2 text-xs text-slate-600">{item.commercial_notes}</p>
                          )}
                        </div>
                        {item.interest_level && (
                          <Badge variant="info">
                            {INTEREST_LEVEL_LABELS[item.interest_level]}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {purchasedItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Prodotti acquistati</h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {purchasedItems.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {PRODUCT_FAMILY_LABELS[item.product_family]}
                      </p>
                      {item.commercial_notes && (
                        <p className="mt-2 text-xs text-slate-600">{item.commercial_notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Storico interessi</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun evento registrato.</p>
          ) : (
            <ul className="space-y-3">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                    <span className="text-xs text-slate-500">
                      {new Date(item.occurred_at).toLocaleString("it-IT")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {PRODUCT_FAMILY_LABELS[item.product_family]}
                    {item.interest_level ? ` · ${INTEREST_LEVEL_LABELS[item.interest_level]}` : ""}
                    {item.event_type ? ` · ${item.event_type}` : ""}
                  </p>
                  {item.notes && <p className="mt-2 text-xs text-slate-500">{item.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
