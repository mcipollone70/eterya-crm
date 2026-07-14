import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  CONTACT_HISTORY_TYPE_LABELS,
  getContactOutcomeLabel,
} from "@/lib/constants/contact-history";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { ContactHistoryItem } from "../services/contact-history.service";

interface ContactHistoryTimelineProps {
  items: ContactHistoryItem[];
  title?: string;
  emptyMessage?: string;
}

export function ContactHistoryTimeline({
  items,
  title = "Storico contatti",
  emptyMessage = "Nessuna attività nello storico.",
}: ContactHistoryTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <ol className="relative space-y-0 border-l border-slate-200 pl-6">
            {items.map((item) => (
              <li key={item.id} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-100" />
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatVisitDate(item.occurred_at)}
                    </p>
                    <Badge variant="info">{CONTACT_HISTORY_TYPE_LABELS[item.type]}</Badge>
                    {item.outcome && (
                      <Badge variant="default">{getContactOutcomeLabel(item.outcome)}</Badge>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-800">{item.title}</p>

                  <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Operatore
                      </dt>
                      <dd>{item.operator_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Prossimo follow-up
                      </dt>
                      <dd>{formatVisitDate(item.next_follow_up_at)}</dd>
                    </div>
                  </dl>

                  {item.company_name && (
                    <p className="mt-2 text-xs text-slate-500">
                      Azienda:{" "}
                      <Link
                        href={`/companies/${item.company_id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {item.company_name}
                      </Link>
                    </p>
                  )}

                  {item.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                      {item.description}
                    </p>
                  )}

                  {item.attachment_count > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Allegati predisposti: {item.attachment_count}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
