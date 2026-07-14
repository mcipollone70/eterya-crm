interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Su mobile nasconde il titolo (già visibile nell'header shell). */
  compactOnMobile?: boolean;
}

/** Intestazione condivisa delle pagine modulo: titolo, sottotitolo e azioni. */
export function PageHeader({
  title,
  subtitle,
  actions,
  compactOnMobile = true,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <h2
          className={`text-xl font-bold text-slate-900 sm:text-2xl ${
            compactOnMobile ? "hidden lg:block" : ""
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 sm:mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
