import { ReportsPage } from "@/features/reports";
import { isDashboardPeriod } from "@/lib/constants/dashboard-filters";

export const metadata = { title: "Dashboard Commerciale Avanzata" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    agent?: string;
    province?: string;
    status?: string;
    period?: string;
  }>;
}) {
  const { agent, province, status, period } = await searchParams;

  return (
    <ReportsPage
      agent={agent}
      province={province}
      status={status}
      period={isDashboardPeriod(period) ? period : undefined}
    />
  );
}
