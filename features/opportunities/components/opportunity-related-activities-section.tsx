import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { FollowUpList } from "@/features/activities/components/follow-up-list";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { VisitTimeline } from "@/features/visits/components/visit-timeline";
import { listVisitsByCompany } from "@/features/visits/services/visits.service";

interface OpportunityRelatedActivitiesSectionProps {
  companyId: string;
}

export async function OpportunityRelatedActivitiesSection({
  companyId,
}: OpportunityRelatedActivitiesSectionProps) {
  const [{ data: followUps, error: followUpsError }, { data: visits, error: visitsError }] =
    await Promise.all([
      listFollowUps({ companyId, limit: 50 }),
      listVisitsByCompany(companyId),
    ]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-3">
        {followUpsError && <p className="text-sm text-rose-700">{followUpsError}</p>}
        <FollowUpList
          items={followUps}
          title="Follow-up azienda"
          showCompany={false}
          emptyMessage="Nessun follow-up per l'azienda collegata."
        />
        <p className="text-xs text-slate-500">
          <Link href={`/activities?company=${companyId}`} className="text-indigo-600 hover:underline">
            Vedi tutte le attività
          </Link>
        </p>
      </div>

      <div className="space-y-3">
        {visitsError && <p className="text-sm text-rose-700">{visitsError}</p>}
        <VisitTimeline visits={visits.slice(0, 12)} />
        <p className="text-xs text-slate-500">
          <Link href={`/visits?company=${companyId}`} className="text-indigo-600 hover:underline">
            Vedi tutte le visite
          </Link>
        </p>
      </div>
    </div>
  );
}
