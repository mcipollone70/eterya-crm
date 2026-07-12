import { Clock, type LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

/**
 * Empty-state condiviso per i moduli non ancora implementati.
 * Compone `PageHeader` + `EmptyState` per restare coerente e DRY.
 */
export function PagePlaceholder({
  title,
  description,
  icon = Clock,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={description} />
      <EmptyState
        icon={icon}
        title="Modulo in arrivo"
        message="Questa sezione è in fase di sviluppo e sarà presto disponibile."
      />
    </div>
  );
}
