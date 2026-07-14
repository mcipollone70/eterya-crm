import { VoicePage } from "@/features/voice";
import { isVoiceIntent } from "@/lib/voice/constants";

export const metadata = { title: "Funzioni vocali" };

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    intent?: string;
  }>;
}) {
  const { company, intent } = await searchParams;

  return (
    <VoicePage
      company={company}
      intent={isVoiceIntent(intent) ? intent : undefined}
    />
  );
}
