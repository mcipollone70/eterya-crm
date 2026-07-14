import { AssistantPage } from "@/features/assistant";

export const metadata = { title: "Assistente commerciale" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    agent?: string;
    briefing?: string;
  }>;
}) {
  const { agent, briefing } = await searchParams;

  return <AssistantPage agent={agent} briefing={briefing} />;
}
