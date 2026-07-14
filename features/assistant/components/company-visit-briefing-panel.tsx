"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Mic,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionItem,
  DescriptionList,
  StickyActionBar,
} from "@/components/ui";
import { buildGoogleMapsDirectionsUrl } from "@/features/maps/utils/map-filters";
import { getContactOutcomeLabel } from "@/lib/constants/contact-history";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import {
  formatDurationMinutes,
  formatLastVisitLabel,
  formatVisitDate,
} from "@/lib/last-visit/format";
import type { CompanyVisitBriefing } from "@/lib/commercial-assistant/types";
import { BriefingFollowUpSheet } from "./briefing-follow-up-sheet";

interface CompanyVisitBriefingPanelProps {
  briefing: CompanyVisitBriefing;
  backHref?: string;
  backLabel?: string;
}

function BriefingActionButton({
  href,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  href?: string;
  onClick?: () => void;
  icon: typeof Phone;
  label: string;
  tone: string;
}) {
  const className = `inline-flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold sm:min-h-12 sm:text-sm ${tone}`;

  if (href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={className}>
        <Icon className="h-5 w-5" />
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

export function CompanyVisitBriefingPanel({
  briefing,
  backHref = "/assistant",
  backLabel = "Torna ai suggerimenti",
}: CompanyVisitBriefingPanelProps) {
  const [showFollowUpSheet, setShowFollowUpSheet] = useState(false);

  const phoneHref = briefing.phone ? `tel:${briefing.phone.replace(/\s+/g, "")}` : undefined;
  const navigateHref =
    briefing.latitude != null && briefing.longitude != null
      ? buildGoogleMapsDirectionsUrl(briefing.latitude, briefing.longitude)
      : undefined;

  const locationLabel = [briefing.city, briefing.province].filter(Boolean).join(" · ");

  const actionButtons = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <BriefingActionButton
        href={phoneHref}
        icon={Phone}
        label="Chiama"
        tone={
          phoneHref
            ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
            : "border-slate-200 bg-slate-100 text-slate-400"
        }
      />
      <BriefingActionButton
        href={navigateHref}
        icon={Navigation}
        label="Naviga"
        tone={
          navigateHref
            ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
            : "border-slate-200 bg-slate-100 text-slate-400"
        }
      />
      <BriefingActionButton
        href={`/voice?company=${briefing.companyId}&intent=visit_note`}
        icon={Mic}
        label="Registra nota vocale"
        tone="border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
      />
      <BriefingActionButton
        href={`/companies/${briefing.companyId}`}
        icon={Building2}
        label="Apri azienda"
        tone="border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      />
      <BriefingActionButton
        onClick={() => setShowFollowUpSheet(true)}
        icon={CalendarClock}
        label="Crea follow-up"
        tone="border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
      />
    </div>
  );

  return (
    <>
      <Card className="border-indigo-200 bg-indigo-50/30">
        {backHref ? (
          <div className="sticky top-0 z-10 border-b border-indigo-100 bg-indigo-50/95 px-4 py-2 backdrop-blur-sm">
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          </div>
        ) : null}

        <CardHeader className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Briefing AI
              </Badge>
              <Badge variant="muted">{briefing.commercialStatus}</Badge>
            </div>
            <CardTitle className="mt-2 text-2xl sm:text-3xl">{briefing.companyName}</CardTitle>
            {locationLabel ? (
              <p className="mt-1 text-sm text-slate-600 sm:text-base">{locationLabel}</p>
            ) : null}
          </div>

          <DescriptionList className="rounded-xl border border-indigo-100 bg-white p-4">
            <DescriptionItem label="Referente" value={briefing.contactName ?? "—"} />
            <DescriptionItem label="Telefono" value={briefing.phone ?? "—"} />
            <DescriptionItem
              label="Ultima visita"
              value={
                briefing.lastVisit.at ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {formatVisitDate(briefing.lastVisit.at)}
                    <Badge variant="info">{formatLastVisitLabel(briefing.lastVisit.at)}</Badge>
                    {briefing.lastVisit.outcome ? (
                      <Badge variant="default">
                        {getVisitOutcomeLabel(briefing.lastVisit.outcome)}
                      </Badge>
                    ) : null}
                  </span>
                ) : (
                  "Nessuna visita registrata"
                )
              }
            />
            <DescriptionItem
              label="Ultimo ordine"
              value={
                briefing.lastOrder.at ? (
                  <span>
                    {formatVisitDate(briefing.lastOrder.at)}
                    {briefing.lastOrder.label ? ` · ${briefing.lastOrder.label}` : ""}
                  </span>
                ) : (
                  "Nessun ordine registrato"
                )
              }
            />
          </DescriptionList>

          <div className="hidden sm:block">{actionButtons}</div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-violet-900 sm:text-lg">
              <Sparkles className="h-5 w-5" />
              Suggerimenti AI
            </h3>
            <ul className="space-y-2">
              {briefing.aiSuggestions.map((suggestion) => (
                <li
                  key={suggestion}
                  className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800 sm:text-base"
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">
              Opportunità aperte
            </h3>
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
              <h3 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">
                Prodotti già acquistati
              </h3>
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
              <h3 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">
                Prodotti mai acquistati
              </h3>
              {briefing.products.neverPurchased.length === 0 ? (
                <p className="text-sm text-slate-500">Catalogo completo già acquistato.</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate-700">
                  {briefing.products.neverPurchased.slice(0, 12).map((product) => (
                    <li key={`${product.name}-${product.family}`}>
                      {product.name} · {product.family}
                    </li>
                  ))}
                  {briefing.products.neverPurchased.length > 12 ? (
                    <li className="text-xs text-slate-500">
                      +{briefing.products.neverPurchased.length - 12} altri prodotti
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">
              Follow-up aperti
            </h3>
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
            <h3 className="mb-3 text-sm font-semibold text-slate-900 sm:text-base">
              Note importanti
            </h3>
            {briefing.importantNotes.length === 0 ? (
              <p className="text-sm text-slate-500">Nessuna nota importante.</p>
            ) : (
              <ul className="space-y-2">
                {briefing.importantNotes.map((note) => (
                  <li
                    key={note}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {briefing.lastVisit.at ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Dettaglio ultima visita</h3>
              <DescriptionList>
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
            </section>
          ) : null}

          {briefing.recentContacts.length > 0 ? (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Storico recente</h3>
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
            </section>
          ) : null}
        </CardContent>
      </Card>

      <StickyActionBar className="sm:hidden">
        {actionButtons}
      </StickyActionBar>

      {showFollowUpSheet ? (
        <BriefingFollowUpSheet
          companyId={briefing.companyId}
          companyName={briefing.companyName}
          onClose={() => setShowFollowUpSheet(false)}
        />
      ) : null}
    </>
  );
}
