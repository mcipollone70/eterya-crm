import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  isContactHistoryPeriod,
  isContactHistoryType,
} from "@/lib/constants/contact-history";
import { ContactHistoryFilters } from "./contact-history-filters";
import { ContactHistoryTimeline } from "./contact-history-timeline";
import { RecordContactActivityForm } from "./record-contact-activity-form";
import {
  listContactHistory,
  listContactHistoryOperators,
  type ContactHistoryItem,
} from "../services/contact-history.service";

interface CompanyContactHistorySectionProps {
  companyId: string;
  basePath: string;
  type?: string;
  period?: string;
  operator?: string;
  search?: string;
}

export async function CompanyContactHistorySection({
  companyId,
  basePath,
  type,
  period,
  operator,
  search,
}: CompanyContactHistorySectionProps) {
  const [{ data: items, error }, { data: operators }] = await Promise.all([
    listContactHistory({
      companyId,
      type: isContactHistoryType(type) ? type : null,
      period: isContactHistoryPeriod(period) && period ? period : null,
      operatorId: operator || null,
      search: search || null,
      limit: 200,
    }),
    listContactHistoryOperators(),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Storico contatti</CardTitle>
          <RecordContactActivityForm companyId={companyId} />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Suspense fallback={null}>
            <ContactHistoryFilters operators={operators} basePath={basePath} />
          </Suspense>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </CardContent>
      </Card>

      <ContactHistoryTimeline
        items={items}
        title="Timeline"
        emptyMessage="Nessuna attività registrata. Usa il pulsante sopra per aggiungere telefonate, email, visite o note."
      />
    </div>
  );
}

export type { ContactHistoryItem };
