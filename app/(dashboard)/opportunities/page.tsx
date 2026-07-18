export const dynamic = "force-dynamic";

import { OpportunitiesPage } from "@/features/opportunities";
import { isPipelinePriorityFilter } from "@/lib/constants/pipeline-filters";

export const metadata = { title: "Pipeline Commerciale" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    agent?: string;
    company?: string;
    priority?: string;
    from?: string;
    to?: string;
    min?: string;
  }>;
}) {
  const { agent, company, priority, from, to, min } = await searchParams;
  const minAmount = min != null && min !== "" ? Number(min) : undefined;

  return (
    <OpportunitiesPage
      agent={agent}
      company={company}
      priority={isPipelinePriorityFilter(priority) ? priority : undefined}
      from={from}
      to={to}
      minAmount={Number.isFinite(minAmount) ? minAmount : undefined}
    />
  );
}
