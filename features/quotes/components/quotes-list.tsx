import Link from "next/link";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { QuoteListItem } from "../services/quotes.service";
import { QuoteStatusBadge } from "./quote-status-badge";

interface QuotesListProps {
  items: QuoteListItem[];
}

export function QuotesList({ items }: QuotesListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Preventivo</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Azienda</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Stato</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Famiglia
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-600">Importo</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 lg:table-cell">
              Validità
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 sm:table-cell">
              Inviato
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-3">
                <Link
                  href={`/preventivi/${item.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {item.number ? `${item.number} · ` : ""}
                  {item.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/companies/${item.company_id}`}
                  className="text-slate-700 hover:text-indigo-700 hover:underline"
                >
                  {item.company_name ?? "—"}
                </Link>
              </td>
              <td className="px-4 py-3">
                <QuoteStatusBadge status={item.status} />
              </td>
              <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                {PRODUCT_FAMILY_LABELS[item.product_family]}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">
                {formatOpportunityAmount(item.total_amount, item.currency)}
              </td>
              <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                {formatVisitDate(item.valid_until)}
              </td>
              <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                {formatVisitDate(item.sent_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
