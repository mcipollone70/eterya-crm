import Link from "next/link";
import { Badge } from "@/components/ui";
import {
  getServiceTicketCategoryLabel,
  SERVICE_TICKET_PRIORITY_LABELS,
} from "@/lib/constants/service-tickets";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { ServiceTicketListItem } from "../services/service-tickets.service";
import { ServiceTicketStatusBadge } from "./service-ticket-status-badge";

interface ServiceTicketsListProps {
  items: ServiceTicketListItem[];
}

const PRIORITY_VARIANT = {
  low: "muted",
  medium: "info",
  high: "danger",
} as const;

export function ServiceTicketsList({ items }: ServiceTicketsListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Ticket</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Azienda</th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Categoria
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Priorità</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Stato</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Apertura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-3">
                <Link
                  href={`/assistenza/${item.id}`}
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
              <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                {getServiceTicketCategoryLabel(item.category)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={PRIORITY_VARIANT[item.priority]}>
                  {SERVICE_TICKET_PRIORITY_LABELS[item.priority]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <ServiceTicketStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatVisitDate(item.opened_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
