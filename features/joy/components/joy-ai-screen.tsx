import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  Flame,
  MapPin,
  Navigation,
  Phone,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import type { JoyData, JoyInsightIcon } from "../types/joy-data";

const INSIGHT_ICONS: Record<JoyInsightIcon, LucideIcon> = {
  sparkles: Sparkles,
  phone: Phone,
  "map-pin": MapPin,
  target: Target,
  calendar: CalendarDays,
  route: Route,
  alert: AlertTriangle,
  flame: Flame,
};

interface JoyAiScreenProps {
  data: JoyData;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{children}</h2>;
}

export function JoyAiScreen({ data }: JoyAiScreenProps) {
  return (
    <div className="space-y-6 pb-4">
      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">Joy AI</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Ciao {data.userName}
            </h1>
            <p className="mt-2 capitalize text-sm text-slate-600 sm:text-base">{data.dateLabel}</p>
            <p className="mt-2 text-sm text-violet-800">
              Ho analizzato visite, agenda, follow-up, opportunità, radar, giro visite e pipeline per
              proporti il piano migliore di oggi.
            </p>
            <Link href="/joy/chat" className="mt-4 inline-block">
              <Button size="sm" className="min-h-10 gap-2 bg-violet-600 hover:bg-violet-700">
                <Sparkles className="h-4 w-4" />
                Apri Joy Chat
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-xl">
            {[
              { label: "Visite oggi", value: data.summary.visitsToday },
              { label: "Agenda", value: data.summary.agendaItems },
              { label: "Follow-up scaduti", value: data.summary.overdueFollowUps },
              { label: "Opportunità", value: data.summary.openOpportunities },
              { label: "Radar", value: data.summary.radarHits },
              { label: "Km previsti", value: `${data.summary.estimatedTourKm} km` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 text-center"
              >
                <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                <p className="text-lg font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <Badge variant="muted">{data.summary.neverVisitedCompanies} mai visitate</Badge>
          <Badge variant="muted">{data.summary.inactiveClients} clienti inattivi</Badge>
          <Badge variant="info">Pipeline {formatOpportunityAmount(data.summary.pipelineValue)}</Badge>
        </div>
      </section>

      {data.error ? (
        <Card>
          <CardContent className="py-4 text-sm text-rose-700">{data.error}</CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>Cosa ti consiglio oggi</SectionTitle>
        {data.recommendations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nessun suggerimento disponibile al momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.recommendations.map((item, index) => {
              const Icon = INSIGHT_ICONS[item.icon];
              return (
                <Card key={item.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-500">#{index + 1}</p>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.explanation}</p>
                      <Link href={item.href} className="mt-3 inline-block">
                        <Button size="sm" className="min-h-10">
                          {item.actionLabel}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Rischi</SectionTitle>
        {data.risks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nessun rischio critico rilevato oggi.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.risks.map((risk) => (
              <Card key={risk.id} className="border-rose-100">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{risk.title}</p>
                    <Badge variant={risk.severity === "high" ? "danger" : "warning"}>
                      {risk.severity === "high" ? "Alto" : "Medio"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{risk.explanation}</p>
                  <Link href={risk.href} className="text-sm font-medium text-indigo-600 hover:underline">
                    Intervieni
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Occasioni</SectionTitle>
        {data.opportunities.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nessuna occasione commerciale in evidenza.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.opportunities.map((group) => (
              <Card key={group.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    {group.title}
                  </CardTitle>
                  <p className="text-sm text-slate-600">{group.explanation}</p>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <ul className="space-y-1 text-sm text-slate-700">
                    {group.companies.map((company) => (
                      <li key={company.id}>
                        <Link
                          href={`/visits?company=${company.id}&briefing=${company.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {company.name}
                        </Link>
                        {company.city ? (
                          <span className="text-slate-500"> · {company.city}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Link href={group.href} className="text-xs font-medium text-indigo-600 hover:underline">
                    Vedi tutte
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Piano della giornata</SectionTitle>
        {data.dayPlan.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center text-sm text-slate-500">
              <p>Nessuna visita pianificata per oggi.</p>
              <Link href="/visits">
                <Button size="sm" variant="outline">
                  Pianifica visite
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.dayPlan.map((item, index) => {
              const phoneHref = item.phone ? `tel:${item.phone.replace(/\s+/g, "")}` : null;
              const navigateHref =
                item.latitude != null && item.longitude != null
                  ? buildGoogleMapsDirectionsUrl(item.latitude, item.longitude)
                  : null;
              const location = [item.city, item.province].filter(Boolean).join(" · ");

              return (
                <Card key={item.visitId}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Tappa {index + 1}</p>
                        <p className="text-lg font-semibold text-slate-900">{item.companyName}</p>
                        <p className="text-sm text-slate-600">
                          {item.scheduledLabel}
                          {location ? ` · ${location}` : ""}
                        </p>
                      </div>
                      <Badge variant="info">{item.status === "in_progress" ? "In corso" : "Pianificata"}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <Link
                        href={`/visits?company=${item.companyId}&briefing=${item.companyId}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 sm:text-sm"
                      >
                        <Sparkles className="h-4 w-4" />
                        Apri briefing
                      </Link>
                      {navigateHref ? (
                        <a
                          href={navigateHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-900 hover:bg-sky-100 sm:text-sm"
                        >
                          <Navigation className="h-4 w-4" />
                          Naviga
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 sm:text-sm">
                          Naviga
                        </span>
                      )}
                      {phoneHref ? (
                        <a
                          href={phoneHref}
                          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 sm:text-sm"
                        >
                          <Phone className="h-4 w-4" />
                          Chiama
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 sm:text-sm">
                          Chiama
                        </span>
                      )}
                      <Link
                        href={`/visits?company=${item.companyId}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
                      >
                        <CalendarClock className="h-4 w-4" />
                        Pianifica
                      </Link>
                      <Link
                        href={`/companies/${item.companyId}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
                      >
                        <Building2 className="h-4 w-4" />
                        Apri azienda
                      </Link>
                    </div>
                    {item.notes ? (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {item.notes}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-center text-xs text-slate-500">
        Joy AI usa solo i dati già presenti nel CRM — nessuna integrazione esterna aggiuntiva.
      </p>
    </div>
  );
}
