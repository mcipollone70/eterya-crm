import { Route } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function RoutesPage() {
  return (
    <PagePlaceholder
      title="Percorsi"
      description="Ottimizza gli itinerari di visita per gli agenti sul campo."
      icon={Route}
    />
  );
}
