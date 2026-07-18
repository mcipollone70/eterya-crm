export const dynamic = "force-dynamic";

import { OrdersPage } from "@/features/orders";

export const metadata = { title: "Ordini" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    agent?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { company, agent, from, to } = await searchParams;

  return <OrdersPage company={company} agent={agent} from={from} to={to} />;
}
