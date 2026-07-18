import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ContactHistoryTimeline } from "@/features/activities/components/contact-history-timeline";
import { RecordContactActivityForm } from "@/features/activities/components/record-contact-activity-form";
import { isCompanyDetailPeriod } from "../constants/company-detail-tabs";
import { listCompanyActivities } from "../services/company-detail.service";
import { CompanyDetailActivityFilters } from "./company-detail-activity-filters";

interface CompanyDetailActivitiesTabProps {
  companyId: string;
  period?: string;
}

export async function CompanyDetailActivitiesTab({
  companyId,
  period,
}: CompanyDetailActivitiesTabProps) {
  const resolvedPeriod =
    isCompanyDetailPeriod(period) && period ? (period as "today" | "week" | "month") : null;

  const { data: items, error } = await listCompanyActivities(companyId, resolvedPeriod);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Attività</CardTitle>
          <RecordContactActivityForm companyId={companyId} />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Suspense fallback={null}>
            <CompanyDetailActivityFilters companyId={companyId} />
          </Suspense>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <p className="text-xs text-slate-500">
            Cronologia di telefonate, visite, email, preventivi, ordini (esito), appuntamenti e note
            registrati nello storico contatti.
          </p>
        </CardContent>
      </Card>

      <ContactHistoryTimeline
        items={items}
        title="Cronologia attività"
        emptyMessage="Nessuna attività nel periodo selezionato. Usa i pulsanti sopra per registrare telefonate, visite o note."
      />
    </div>
  );
}
