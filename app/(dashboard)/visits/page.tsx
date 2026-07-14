import { VisitsPage } from "@/features/visits";
import { isVisitPeriod } from "@/lib/constants/visit-workflow";

export const metadata = { title: "Visite" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; company?: string; briefing?: string }>;
}) {
  const { period, company, briefing } = await searchParams;

  return (
    <VisitsPage
      period={isVisitPeriod(period) ? period : undefined}
      company={company}
      briefing={briefing}
    />
  );
}
