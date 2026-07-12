import { Mic } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function VoicePage() {
  return (
    <PagePlaceholder
      title="Promemoria vocali"
      description="Registra note vocali e ottieni trascrizioni automatiche con l'AI."
      icon={Mic}
    />
  );
}
