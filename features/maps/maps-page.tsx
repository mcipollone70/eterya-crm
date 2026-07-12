import { Map } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function MapsPage() {
  return (
    <PagePlaceholder
      title="Mappe"
      description="Visualizza le aziende geolocalizzate su mappa interattiva."
      icon={Map}
    />
  );
}
