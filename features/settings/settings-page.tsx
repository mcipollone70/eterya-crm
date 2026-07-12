import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="Impostazioni"
      description="Configura l'account, il team e le preferenze del CRM."
      icon={Settings}
    />
  );
}
