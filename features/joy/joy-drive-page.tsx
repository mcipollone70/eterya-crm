import { Mic } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { JoyDriveScreen } from "./components/joy-drive-screen";

export async function JoyDrivePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Joy Drive"
          subtitle="Assistente vocale commerciale per smartphone."
        />
        <EmptyState
          icon={Mic}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare Joy Drive."
        />
      </div>
    );
  }

  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentUserProfile()]);
  const userDisplayName =
    profile?.fullName?.trim() || user?.email?.split("@")[0] || "Tu";

  return <JoyDriveScreen userDisplayName={userDisplayName} />;
}
