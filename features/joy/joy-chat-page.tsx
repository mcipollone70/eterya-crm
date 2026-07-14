import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { JoyChatScreen } from "./chat/components/joy-chat-screen";

export async function JoyChatPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Joy Chat" subtitle="Assistente conversazionale operativo." />
        <EmptyState
          icon={MessageSquare}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare Joy Chat."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Joy Chat & Copilot"
        subtitle="Chiedi informazioni o esegui azioni operative nel CRM con conferma."
        actions={
          <Link
            href="/joy"
            className="text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            Dashboard Joy
          </Link>
        }
      />
      <JoyChatScreen />
    </div>
  );
}
