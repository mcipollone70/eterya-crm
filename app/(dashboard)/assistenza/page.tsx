export const dynamic = "force-dynamic";

import { ServicePage } from "@/features/service";

export const metadata = { title: "Gestione Assistenza" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    product?: string;
    agent?: string;
    status?: string;
    priority?: string;
  }>;
}) {
  const params = await searchParams;

  return <ServicePage {...params} />;
}
