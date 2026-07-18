import { Bot } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { JoyAiAssistantScreen } from "./components/joy-ai-assistant-screen";

export async function JoyAiPage({
  initialPrompt,
  companyId,
  companyName,
}: {
  initialPrompt?: string;
  companyId?: string;
  companyName?: string;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="JOY Command Center"
          subtitle="AI Sales Operating System"
        />
        <EmptyState
          icon={Bot}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare Joy."
        />
      </div>
    );
  }

  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentUserProfile()]);
  const userDisplayName =
    profile?.fullName?.trim() || user?.email?.split("@")[0] || "Tu";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="JOY Command Center"
          subtitle="AI Sales Operating System"
        />
        <Link href="/joy-ai/drive" className="shrink-0 sm:pb-1">
          <Button type="button" variant="primary" className="min-h-11 w-full gap-2 sm:w-auto">
            Avvia modalità guida
          </Button>
        </Link>
      </div>
      <JoyAiAssistantScreen
        userDisplayName={userDisplayName}
        userAvatarUrl={profile?.avatarUrl ?? null}
        initialPrompt={initialPrompt}
        companyId={companyId}
        companyName={companyName}
      />
    </div>
  );
}
