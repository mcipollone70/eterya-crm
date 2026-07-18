import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { MANUAL_CHANGELOG } from "../content/changelog";
import { cn } from "@/utils/cn";

interface ManualeChangelogProps {
  highlighted?: boolean;
}

export function ManualeChangelog({ highlighted = false }: ManualeChangelogProps) {
  return (
    <section
      id="cronologia-aggiornamenti"
      aria-labelledby="cronologia-aggiornamenti-title"
      className={cn(
        "scroll-mt-24 rounded-xl transition-colors duration-700",
        highlighted && "ring-2 ring-indigo-400 ring-offset-2"
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle id="cronologia-aggiornamenti-title" className="text-base sm:text-lg">
            Cronologia aggiornamenti
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Storico delle versioni del manuale operativo.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <ol className="relative space-y-6 border-l-2 border-indigo-100 pl-6">
            {MANUAL_CHANGELOG.map((entry) => (
              <li key={entry.version} className="relative">
                <span
                  className="absolute -left-[1.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-white"
                  aria-hidden="true"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-bold text-indigo-700">v{entry.version}</span>
                    <span className="text-xs text-slate-500">{entry.date}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{entry.title}</h3>
                  <ul className="mt-2 space-y-1">
                    {entry.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-indigo-400" aria-hidden="true">
                          •
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
