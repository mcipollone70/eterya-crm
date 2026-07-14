import { AdvancedDashboardPage } from "@/features/dashboard";
import { isDashboardCommercialStatus, isDashboardPeriod } from "@/lib/constants/dashboard-filters";

interface ReportsPageProps {
  agent?: string;
  province?: string;
  status?: string;
  period?: string;
}

export default function ReportsPage({
  agent,
  province,
  status,
  period,
}: ReportsPageProps) {
  return (
    <AdvancedDashboardPage
      agent={agent}
      province={province}
      status={isDashboardCommercialStatus(status) ? status : undefined}
      period={isDashboardPeriod(period) ? period : undefined}
    />
  );
}
