import { JoyAiPage } from "@/features/joy/joy-ai-page";
import { getCompanyById } from "@/features/companies";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string }>;
}) {
  const { q, company } = await searchParams;
  const companyId = company?.trim() || undefined;

  let companyName: string | undefined;
  if (companyId) {
    const { data } = await getCompanyById(companyId);
    companyName = data?.name ?? undefined;
  }

  return (
    <JoyAiPage
      initialPrompt={q?.trim() || undefined}
      companyId={companyId}
      companyName={companyName}
    />
  );
}
