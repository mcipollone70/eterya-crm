import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import {
  FOLLOW_UP_PRIORITY_LABELS,
  FOLLOW_UP_STATUS_LABELS,
} from "@/lib/constants/follow-up";
import { formatVisitDate } from "@/lib/last-visit/format";
import { FollowUpRowActions } from "./follow-up-row-actions";
import type { FollowUpListItem } from "../services/follow-ups.service";

interface FollowUpListProps {
  items: FollowUpListItem[];
  title?: string;
  emptyMessage?: string;
  showCompany?: boolean;
}

function priorityVariant(priority: FollowUpListItem["priority"]) {
  if (priority === "high") {
    return "danger" as const;
  }
  if (priority === "medium") {
    return "warning" as const;
  }
  return "muted" as const;
}

function statusVariant(status: FollowUpListItem["status"]) {
  if (status === "completed") {
    return "success" as const;
  }
  if (status === "postponed") {
    return "info" as const;
  }
  if (status === "cancelled") {
    return "muted" as const;
  }
  return "default" as const;
}

export function FollowUpList({
  items,
  title = "Follow-up",
  emptyMessage = "Nessun follow-up pianificato.",
  showCompany = true,
}: FollowUpListProps) {
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
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const canAct = item.status === "todo" || item.status === "postponed";
              return (
                <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatVisitDate(item.effective_at)}
                        </p>
                        <Badge variant="info">{CONTACT_HISTORY_TYPE_LABELS[item.activity_type]}</Badge>
                        <Badge variant={priorityVariant(item.priority)}>
                          {FOLLOW_UP_PRIORITY_LABELS[item.priority]}
                        </Badge>
                        <Badge variant={statusVariant(item.status)}>
                          {FOLLOW_UP_STATUS_LABELS[item.status]}
                        </Badge>
                      </div>

                      {showCompany && item.company_name && (
                        <p className="text-sm text-slate-600">
                          Azienda:{" "}
                          <Link
                            href={`/companies/${item.company_id}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {item.company_name}
                          </Link>
                        </p>
                      )}

                      {item.contact_name && (
                        <p className="text-sm text-slate-600">Contatto: {item.contact_name}</p>
                      )}

                      {item.description && (
                        <p className="text-sm text-slate-700">{item.description}</p>
                      )}

                      <p className="text-xs text-slate-500">
                        Operatore: {item.operator_name ?? "—"}
                      </p>
                    </div>

                    <FollowUpRowActions
                      followUpId={item.id}
                      companyId={item.company_id}
                      canAct={canAct}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
