/** Skeleton leggero per fallback Suspense. */
export function PageLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}
