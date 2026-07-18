import Link from "next/link";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { SampleListItem } from "../services/samples.service";
import { SampleStatusBadge } from "./sample-status-badge";

interface SamplesListProps {
  items: SampleListItem[];
}

export function SamplesList({ items }: SamplesListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Campione</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Azienda</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Prodotto
            </th>
            <th className="px-4 py-3 text-center font-medium text-slate-600">Q.tà</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Stato</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Consegna</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 lg:table-cell">
              Rientro previsto
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-3">
                <Link
                  href={`/campioni/${item.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
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
              <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                {item.product_name ?? "—"}
              </td>
              <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
              <td className="px-4 py-3">
                <SampleStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatVisitDate(item.given_at)}</td>
              <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                {formatVisitDate(item.expected_return_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
