import { PageHeader } from "@/components/ui";
import { getGoogleCalendarSettingsAction } from "@/features/calendar-sync/actions/calendar-actions";
import { GoogleCalendarSettingsPanel } from "@/features/calendar-sync/components/google-calendar-settings-panel";

interface SettingsPageProps {
  google_calendar?: string;
  message?: string;
}

export async function SettingsPage({
  google_calendar,
  message,
}: SettingsPageProps) {
  const settings = await getGoogleCalendarSettingsAction();

  const flashMessage =
    google_calendar === "connected" ? message ?? "Google Calendar collegato." : null;
  const flashError = google_calendar === "error" ? message ?? "Collegamento non riuscito." : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Impostazioni"
        subtitle="Account, integrazioni e preferenze del CRM."
      />

      <GoogleCalendarSettingsPanel
        connection={settings.connection}
        configured={settings.configured}
        redirectUri={settings.redirectUri}
        flashMessage={flashMessage}
        flashError={flashError}
      />
    </div>
  );
}
