import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { OrderListItem } from "../services/orders.service";

interface OrdersListProps {
  items: OrderListItem[];
}

export function OrdersList({ items }: OrdersListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Ordine</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Azienda</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Famiglia
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-600">Importo</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Data ordine</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-3">
                <Link
                  href={`/ordini/${item.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {item.number ? `${item.number} · ` : ""}
                  {item.title}
                </Link>
                <Badge variant="success" className="ml-2">
                  Vinto
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${item.company_id}`}
                  className="text-slate-700 hover:text-indigo-700 hover:underline"
                >
                  {item.company_name ?? "—"}
                </Link>
              </td>
              <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                {PRODUCT_FAMILY_LABELS[item.product_family]}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">
                {formatOpportunityAmount(item.total_amount, item.currency)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {formatVisitDate(item.accepted_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
