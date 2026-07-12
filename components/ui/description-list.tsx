import { cn } from "@/utils/cn";

export function DescriptionList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDListElement>) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        className
      )}
      {...props}
    />
  );
}

interface DescriptionItemProps {
  label: string;
  value?: React.ReactNode;
  /** Occupa entrambe le colonne (es. note). */
  span?: boolean;
}

/** Voce di dettaglio (label + valore) con placeholder "—" per valori vuoti. */
export function DescriptionItem({ label, value, span }: DescriptionItemProps) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">
        {isEmpty ? <span className="text-slate-300">—</span> : value}
      </dd>
    </div>
  );
}
