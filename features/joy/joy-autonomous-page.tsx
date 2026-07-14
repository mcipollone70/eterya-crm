import Link from "next/link";
import { Sparkles } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { CompanyBriefingLoader } from "@/features/assistant/components/company-briefing-loader";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { JoyAutonomousScreen } from "./autonomous/components/joy-autonomous-screen";
import { getJoyAutonomousData } from "./autonomous/services/joy-autonomous.service";

interface JoyAutonomousPageProps {
  searchParams?: Promise<{
    focus?: string;
  }>;
}

export async function JoyAutonomousPage({ searchParams }: JoyAutonomousPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Joy Autonomous" subtitle="Centro operativo intelligente del CRM." />
        <EmptyState
          icon={Sparkles}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare Joy Autonomous."
        />
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const focusCompanyId = params.focus?.trim() || null;

  if (focusCompanyId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Modalità Focus"
          subtitle="Un cliente alla volta con briefing completo e azioni rapide."
          actions={
            <Link
              href="/joy/autonomous"
              className="text-sm font-medium text-violet-700 hover:text-violet-900"
            >
              Torna al centro operativo
            </Link>
          }
        />
        <CompanyBriefingLoader
          companyId={focusCompanyId}
          backHref="/joy/autonomous"
          backLabel="Torna a Joy Autonomous"
        />
      </div>
    );
  }

  const data = await getJoyAutonomousData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Joy Autonomous"
        subtitle="Centro operativo con briefing, notifiche, decisioni e focus cliente."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/joy/chat" className="text-sm font-medium text-violet-700 hover:text-violet-900">
              Joy Copilot
            </Link>
            <Link href="/joy" className="text-sm font-medium text-violet-700 hover:text-violet-900">
              Dashboard Joy
            </Link>
          </div>
        }
      />
      <JoyAutonomousScreen data={data} />
    </div>
  );
}
