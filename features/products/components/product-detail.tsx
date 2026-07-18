import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import {
  INTEREST_LEVEL_LABELS,
  PRODUCT_FAMILY_LABELS,
  formatPriceRange,
} from "@/lib/constants/product-catalog";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { ProductListItem } from "../services/products.service";
import type { ProductCompanyInterestItem } from "../services/company-product-interests.service";

interface ProductDetailProps {
  product: ProductListItem;
  companyLinks?: ProductCompanyInterestItem[];
  companyLinksError?: string | null;
}

const RELATION_LABELS: Record<string, string> = {
  purchased: "Acquistato",
  interest: "Interesse",
};

export function ProductDetail({
  product,
  companyLinks = [],
  companyLinksError = null,
}: ProductDetailProps) {
  const purchased = companyLinks.filter((item) => item.relation_type === "purchased");
  const interests = companyLinks.filter((item) => item.relation_type === "interest");

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        subtitle={PRODUCT_FAMILY_LABELS[product.family]}
        actions={
          <Link href={`/products/${product.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              Modifica
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Scheda prodotto</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem label="Famiglia" value={PRODUCT_FAMILY_LABELS[product.family]} />
            <DescriptionItem
              label="Stato"
              value={product.is_active ? "Attivo" : "Non attivo"}
            />
            <DescriptionItem
              label="Fascia prezzo"
              value={formatPriceRange(product.price_range_min, product.price_range_max)}
            />
            <DescriptionItem label="Descrizione" value={product.description ?? "—"} span />
            <DescriptionItem label="Note" value={product.notes ?? "—"} span />
            <DescriptionItem label="Creato il" value={formatVisitDate(product.created_at)} />
            <DescriptionItem label="Aggiornato il" value={formatVisitDate(product.updated_at)} />
          </DescriptionList>
          <div className="mt-4">
            <Badge variant={product.is_active ? "success" : "muted"}>
              {product.is_active ? "In catalogo attivo" : "Non attivo"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aziende collegate</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {companyLinksError && (
            <p className="py-4 text-center text-sm text-rose-700">{companyLinksError}</p>
          )}
          {!companyLinksError && companyLinks.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">
              Nessuna azienda ha ancora collegato interesse o acquisto a questo prodotto.
            </p>
          )}
          {!companyLinksError && companyLinks.length > 0 && (
            <div className="space-y-4">
              {purchased.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Acquistato ({purchased.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {purchased.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <Link
                          href={`/companies/${item.company_id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {item.company_name ?? "Azienda"}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {RELATION_LABELS[item.relation_type] ?? item.relation_type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {interests.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">
                    Interesse ({interests.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {interests.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <Link
                          href={`/companies/${item.company_id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {item.company_name ?? "Azienda"}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {item.interest_level &&
                          item.interest_level in INTEREST_LEVEL_LABELS
                            ? INTEREST_LEVEL_LABELS[
                                item.interest_level as keyof typeof INTEREST_LEVEL_LABELS
                              ]
                            : "Interesse"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
