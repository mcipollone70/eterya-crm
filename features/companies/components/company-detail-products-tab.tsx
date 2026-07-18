import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  INTEREST_LEVEL_LABELS,
  PRODUCT_FAMILIES,
  PRODUCT_FAMILY_LABELS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { listProducts } from "@/features/products/services/products.service";
import {
  listCompanyProductInterests,
  listCompanyProductInterestHistory,
} from "@/features/products/services/company-product-interests.service";
import { AddCompanyProductForm } from "@/features/products/components/add-company-product-form";

interface CompanyDetailProductsTabProps {
  companyId: string;
}

const PREMIUM_FAMILY_GROUPS: Array<{
  key: string;
  label: string;
  families: ProductFamily[];
}> = [
  { key: "zanzariere", label: "Zanzariere", families: ["zanzariere"] },
  { key: "tapparelle", label: "Tapparelle", families: ["tapparelle"] },
  { key: "vepa", label: "VEPA", families: ["vepa"] },
  { key: "cristal", label: "Cristal", families: ["tende_cristal"] },
  {
    key: "tende",
    label: "Tende",
    families: ["tende_tecniche_rullo"],
  },
];

function formatInterestSummary(
  interests: Awaited<ReturnType<typeof listCompanyProductInterests>>["data"],
  families: ProductFamily[]
) {
  const matches = interests.filter(
    (item) =>
      item.relation_type === "interest" && families.includes(item.product_family)
  );

  if (matches.length === 0) {
    return null;
  }

  const levels = matches
    .map((item) => (item.interest_level ? INTEREST_LEVEL_LABELS[item.interest_level] : null))
    .filter(Boolean);

  return {
    count: matches.length,
    products: matches.map((item) => item.product_name),
    levels,
  };
}

export async function CompanyDetailProductsTab({ companyId }: CompanyDetailProductsTabProps) {
  const [productsResult, interestsResult, historyResult] = await Promise.all([
    listProducts({ activeOnly: true }),
    listCompanyProductInterests(companyId),
    listCompanyProductInterestHistory(companyId, 30),
  ]);

  const products = productsResult.data;
  const interests = interestsResult.data;
  const history = historyResult.data;
  const error = interestsResult.error ?? historyResult.error ?? productsResult.error;

  const coveredFamilies = new Set(
    interests
      .filter((item) => item.relation_type === "interest")
      .map((item) => item.product_family)
  );

  const otherInterests = interests.filter(
    (item) =>
      item.relation_type === "interest" &&
      !PRODUCT_FAMILIES.includes(item.product_family as ProductFamily)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Interessi per famiglia prodotto</CardTitle>
          <AddCompanyProductForm companyId={companyId} products={products} />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {error && <p className="text-sm text-rose-700">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PREMIUM_FAMILY_GROUPS.map((group) => {
              const summary = formatInterestSummary(interests, group.families);
              return (
                <div
                  key={group.key}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                    <Badge variant={summary ? "info" : "muted"}>
                      {summary ? "Interesse" : "Nessun interesse"}
                    </Badge>
                  </div>
                  {summary ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>{summary.products.join(", ")}</p>
                      {summary.levels.length > 0 && (
                        <p>Livello: {[...new Set(summary.levels)].join(", ")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Nessun dato registrato.</p>
                  )}
                </div>
              );
            })}

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Altri prodotti</p>
                <Badge variant={otherInterests.length > 0 ? "info" : "muted"}>
                  {otherInterests.length > 0 ? "Interesse" : "Nessun interesse"}
                </Badge>
              </div>
              {otherInterests.length > 0 ? (
                <p className="mt-2 text-xs text-slate-600">
                  {otherInterests.map((item) => item.product_name).join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {coveredFamilies.size === 0
                    ? "Nessun prodotto collegato."
                    : "Tutti gli interessi rientrano nelle famiglie principali."}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {interests.filter((item) => item.relation_type === "interest").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dettaglio interessi commerciali</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {interests
                .filter((item) => item.relation_type === "interest")
                .map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {PRODUCT_FAMILY_LABELS[item.product_family]}
                        </p>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Storico interessi</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
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
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
