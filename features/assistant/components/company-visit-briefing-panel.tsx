import Link from "next/link";
import { ArrowLeft, CalendarPlus, MapPin } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, DescriptionItem, DescriptionList } from "@/components/ui";
import { getContactOutcomeLabel } from "@/lib/constants/contact-history";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import {
  formatDurationMinutes,
  formatLastVisitLabel,
  formatVisitDate,
} from "@/lib/last-visit/format";
import type { CompanyVisitBriefing } from "@/lib/commercial-assistant/types";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";

interface CompanyVisitBriefingPanelProps {
  briefing: CompanyVisitBriefing;
}

export function CompanyVisitBriefingPanel({ briefing }: CompanyVisitBriefingPanelProps) {
  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <div className="sticky top-0 z-10 border-b border-indigo-100 bg-indigo-50/95 px-4 py-2 backdrop-blur-sm sm:hidden">
        <Link
          href="/assistant"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna ai suggerimenti
        </Link>
      </div>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Briefing pre-visita · {briefing.companyName}</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            {[briefing.city, briefing.province].filter(Boolean).join(" · ")} ·{" "}
            {briefing.commercialStatus}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href={`/visits?company=${briefing.companyId}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <CalendarPlus className="h-4 w-4" />
            Pianifica visita
          </Link>
          <Link
            href={companyRegisterVisitHref(briefing.companyId)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <MapPin className="h-4 w-4" />
            Registra visita
          </Link>
          <Link
            href={`/companies/${briefing.companyId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Scheda completa
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Ultima visita</h3>
          {!briefing.lastVisit.at ? (
            <p className="text-sm text-slate-500">Nessuna visita registrata.</p>
          ) : (
            <DescriptionList>
              <DescriptionItem
                label="Data"
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    {formatVisitDate(briefing.lastVisit.at)}
                    <Badge variant="info">{formatLastVisitLabel(briefing.lastVisit.at)}</Badge>
                  </span>
                }
              />
              <DescriptionItem
                label="Esito"
                value={getVisitOutcomeLabel(briefing.lastVisit.outcome)}
              />
              <DescriptionItem
                label="Durata"
                value={formatDurationMinutes(briefing.lastVisit.durationMinutes)}
              />
              <DescriptionItem
                label="Prossimo richiamo"
                value={formatVisitDate(briefing.lastVisit.nextCallbackAt)}
              />
              <DescriptionItem label="Note visita" value={briefing.lastVisit.notes} span />
            </DescriptionList>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Opportunità aperte</h3>
          {briefing.opportunities.openCount === 0 ? (
            <p className="text-sm text-slate-500">Nessuna opportunità aperta.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                {briefing.opportunities.openCount} aperte ·{" "}
                {formatOpportunityAmount(briefing.opportunities.totalValue)} · prob. media{" "}
                {briefing.opportunities.averageProbability}%
              </p>
              <ul className="space-y-2">
                {briefing.opportunities.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.stage} · {formatOpportunityAmount(item.amount)}
                      {item.probability != null ? ` · ${item.probability}%` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Prodotti acquistati</h3>
            {briefing.products.purchased.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun prodotto acquistato registrato.</p>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {briefing.products.purchased.map((product) => (
                  <li key={`${product.name}-${product.family}`}>
                    {product.name} · {product.family}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Interessi prodotto</h3>
            {briefing.products.interests.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun interesse registrato.</p>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {briefing.products.interests.map((product) => (
                  <li key={`${product.name}-${product.family}`}>
                    {product.name} · {product.family}
                    {product.level ? ` (${product.level})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Follow-up aperti</h3>
          {briefing.followUps.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun follow-up aperto.</p>
          ) : (
            <ul className="space-y-2">
              {briefing.followUps.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">
                    {item.activityType} · {formatVisitDate(item.scheduledAt)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.status} · {item.priority}
                    {item.description ? ` · ${item.description}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Note e storico recente</h3>
          {(briefing.notes || briefing.internalNotes) && (
            <div className="mb-3 space-y-2 text-sm text-slate-700">
              {briefing.notes && <p>Note: {briefing.notes}</p>}
              {briefing.internalNotes && <p>Note interne: {briefing.internalNotes}</p>}
            </div>
          )}
          {briefing.recentContacts.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun contatto recente.</p>
          ) : (
            <ul className="space-y-2">
              {briefing.recentContacts.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">
                    {item.type} · {item.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatVisitDate(item.occurredAt)}
                    {item.outcome ? ` · ${getContactOutcomeLabel(item.outcome)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
