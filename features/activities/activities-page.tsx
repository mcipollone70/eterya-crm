import { CheckSquare } from "lucide-react";
import { PagePlaceholder } from "@/components/ui";

export function ActivitiesPage() {
  return (
    <PagePlaceholder
      title="Attività"
      description="Organizza task, chiamate e follow-up del team commerciale."
      icon={CheckSquare}
    />
  );
}
