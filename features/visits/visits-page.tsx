import { MapPin } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function VisitsPage() {
  return (
    <PagePlaceholder
      title="Visite"
      description="Pianifica e monitora le visite ai clienti sul territorio."
      icon={MapPin}
    />
  );
}
