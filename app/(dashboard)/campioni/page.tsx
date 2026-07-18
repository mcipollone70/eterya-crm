export const dynamic = "force-dynamic";

import { SamplesPage } from "@/features/samples";

export const metadata = { title: "Gestione Campioni" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    product?: string;
    agent?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;

  return <SamplesPage {...params} />;
}
