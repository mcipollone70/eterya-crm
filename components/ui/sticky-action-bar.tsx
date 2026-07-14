import { cn } from "@/utils/cn";

interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
}

/** Barra azioni fissa in basso su mobile (sopra la bottom nav). */
export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-14 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm safe-bottom lg:static lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none",
        className
      )}
    >
      {children}
    </div>
  );
}
