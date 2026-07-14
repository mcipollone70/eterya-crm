"use client";

import Link from "next/link";
import { Building2, CalendarPlus, FileText, MapPin, Route, Target } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PriorityBadge } from "@/features/companies/components/priority-badge";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import type { CommercialStatus } from "@/lib/supabase/types";
import { formatDistanceKm } from "@/features/maps/utils/geo-distance";
import type { DailyVisitSuggestion } from "@/lib/commercial-assistant/types";

interface SuggestionCardProps {
  suggestion: DailyVisitSuggestion;
  rank: number;
}

export function SuggestionCard({ suggestion, rank }: SuggestionCardProps) {
  const location = [suggestion.city, suggestion.province].filter(Boolean).join(" · ");
  const statusLabel =
    COMMERCIAL_STATUS_LABELS[suggestion.commercialStatus as CommercialStatus] ??
    suggestion.commercialStatus;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            #{rank} consigliata
          </p>
          <CardTitle className="text-lg">
            <Link href={`/companies/${suggestion.companyId}`} className="hover:text-indigo-600">
              {suggestion.companyName}
            </Link>
          </CardTitle>
          {location && <p className="text-sm text-slate-500">{location}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge score={suggestion.score} tier={suggestion.tier} />
          <Badge variant="muted">{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Perché oggi
          </p>
          <p className="mt-1 text-sm text-slate-800">{suggestion.reasons.join(" · ")}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {suggestion.signals.distanceKm != null && (
            <span>Distanza: {formatDistanceKm(suggestion.signals.distanceKm)}</span>
          )}
          {suggestion.signals.openOpportunityCount > 0 && (
            <span>Opportunità: {suggestion.signals.openOpportunityCount}</span>
          )}
          {suggestion.signals.maxOpportunityProbability != null && (
            <span>Prob. max: {suggestion.signals.maxOpportunityProbability}%</span>
          )}
          {suggestion.signals.hasOverdueFollowUp && <span>Follow-up scaduto</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/assistant?briefing=${suggestion.companyId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <FileText className="h-4 w-4" />
            Briefing visita
          </Link>
          <Link
            href={`/visits?company=${suggestion.companyId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" />
            Pianifica
          </Link>
          <Link
            href={companyRegisterVisitHref(suggestion.companyId)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <MapPin className="h-4 w-4" />
            Registra
          </Link>
          <Link
            href={`/companies/${suggestion.companyId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Building2 className="h-4 w-4" />
            Scheda
          </Link>
          <Link
            href="/routes"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Route className="h-4 w-4" />
            Giro
          </Link>
          {suggestion.signals.openOpportunityCount > 0 && (
            <Link
              href="/opportunities"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Target className="h-4 w-4" />
              Opportunità
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
