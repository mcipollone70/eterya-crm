import { AlertCircle, Lightbulb, ListOrdered } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ManualSection } from "../types";
import { ManualMedia } from "./manual-media";
import { cn } from "@/utils/cn";

interface ManualeSectionProps {
  section: ManualSection;
  highlighted?: boolean;
}

export function ManualeSection({ section, highlighted = false }: ManualeSectionProps) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className={cn(
        "scroll-mt-24 rounded-xl transition-colors duration-700",
        highlighted && "ring-2 ring-indigo-400 ring-offset-2"
      )}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle id={`${section.id}-title`} className="text-base sm:text-lg">
              {section.title}
            </CardTitle>
            {section.comingSoon && (
              <Badge variant="warning">In arrivo</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              A cosa serve
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{section.purpose}</p>
          </div>

          {section.showMedia && (
            <ManualMedia caption={`Guida visiva: ${section.title}`} />
          )}

          {section.comingSoon ? (
            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Funzione prevista in un prossimo aggiornamento.
            </div>
          ) : (
            <>
              {section.steps && section.steps.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ListOrdered className="h-3.5 w-3.5" />
                    Procedura
                  </div>
                  <ol className="space-y-2">
                    {section.steps.map((step, index) => (
                      <li
                        key={index}
                        className="flex gap-3 text-sm leading-relaxed text-slate-700"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {section.tips && section.tips.length > 0 && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Suggerimenti
                  </div>
                  <ul className="space-y-1.5">
                    {section.tips.map((tip, index) => (
                      <li
                        key={index}
                        className="flex gap-2 text-sm leading-relaxed text-emerald-900"
                      >
                        <span className="text-emerald-500">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.errors && section.errors.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Errori comuni e soluzione
                  </div>
                  <div className="space-y-3">
                    {section.errors.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-medium text-slate-900">{item.problem}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {item.solution}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
