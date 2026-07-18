export const dynamic = "force-dynamic";

import { QuotesPage } from "@/features/quotes";
import { isQuoteStatus } from "@/lib/constants/quotes";

export const metadata = { title: "Preventivi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    company?: string;
    agent?: string;
  }>;
}) {
  const { status, company, agent } = await searchParams;

  return (
    <QuotesPage
      status={isQuoteStatus(status) ? status : undefined}
      company={company}
      agent={agent}
    />
  );
}
