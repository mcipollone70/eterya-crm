import { Shield } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { MANUAL_ADMIN_TOPICS } from "../content/admin-section";
import { cn } from "@/utils/cn";

interface ManualeAdminSectionProps {
  highlighted?: boolean;
}

export function ManualeAdminSection({ highlighted = false }: ManualeAdminSectionProps) {
  return (
    <section
      id="manuale-amministratore"
      aria-labelledby="manuale-amministratore-title"
      className={cn(
        "scroll-mt-24 rounded-xl transition-colors duration-700",
        highlighted && "ring-2 ring-indigo-400 ring-offset-2"
      )}
    >
      <Card className="border-indigo-100">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            <CardTitle id="manuale-amministratore-title" className="text-base sm:text-lg">
              Manuale Amministratore
            </CardTitle>
            <Badge variant="info">Solo Amministratore</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Procedure riservate agli account org_admin e super_admin.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {MANUAL_ADMIN_TOPICS.map((topic) => (
            <article
              key={topic.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
              aria-labelledby={`${topic.id}-title`}
            >
              <h3 id={`${topic.id}-title`} className="text-sm font-semibold text-slate-900">
                {topic.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{topic.description}</p>

              {topic.technicalNote && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {topic.technicalNote}
                </p>
              )}

              <ol className="mt-3 space-y-1.5">
                {topic.steps.map((step, index) => (
                  <li key={index} className="flex gap-2 text-sm text-slate-700">
                    <span className="font-medium text-indigo-600">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
