import Link from "next/link";
import {
  Bot,
  CalendarPlus,
  FileText,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Route,
  ShoppingCart,
  StickyNote,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { COMMERCIAL_STATUS_LABELS, normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { PRIORITY_TIER_LABELS } from "@/lib/constants/priority-tier";
import type { PriorityTier } from "@/lib/commercial-priority/types";
import type { CommercialStatus } from "@/lib/supabase/types";
import { RecordContactActivityForm } from "@/features/activities/components/record-contact-activity-form";
import { RecordVisitForm } from "@/features/visits/components/record-visit-form";
import { CommercialStatusBadge } from "./commercial-status-badge";
import { PriorityBadge } from "./priority-badge";

interface CompanyDetailSummaryProps {
  companyId: string;
  commercialStatus: CommercialStatus;
  priorityTier: PriorityTier;
  priorityScore: number;
  registerVisit?: boolean;
}

const PRIORITY_BADGE_STYLES: Record<PriorityTier, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
  none: "bg-slate-50 text-slate-400 border-slate-200",
};

export function CompanyDetailSummary({
  companyId,
  commercialStatus,
  priorityTier,
  priorityScore,
  registerVisit = false,
}: CompanyDetailSummaryProps) {
  const normalizedStatus = normalizeCommercialStatus(commercialStatus);
  const isClient = normalizedStatus === "cliente";
  const isProspect = normalizedStatus === "prospect";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {isClient && <Badge variant="success">Cliente</Badge>}
        {isProspect && <Badge variant="info">Prospect</Badge>}
        {!isClient && !isProspect && (
          <CommercialStatusBadge status={commercialStatus} />
        )}
        {priorityTier !== "none" && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE_STYLES[priorityTier]}`}
          >
            {PRIORITY_TIER_LABELS[priorityTier]} priorità
          </span>
        )}
        <PriorityBadge score={priorityScore} tier={priorityTier} />
        <span className="text-xs text-slate-400">
          {COMMERCIAL_STATUS_LABELS[normalizedStatus]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <RecordContactActivityForm companyId={companyId} />
        <RecordVisitForm companyId={companyId} defaultOpen={registerVisit} />
        <Link href={`/visits?company=${companyId}`}>
          <Button type="button" size="sm" variant="outline">
            <CalendarPlus className="h-4 w-4" />
            Nuovo appuntamento
          </Button>
        </Link>
        <Link href={`/companies/${companyId}?tab=note`}>
          <Button type="button" size="sm" variant="outline">
            <StickyNote className="h-4 w-4" />
            Nuova nota
          </Button>
        </Link>
        <Link href={`/companies/${companyId}?tab=attivita`}>
          <Button type="button" size="sm" variant="outline">
            Cronologia
          </Button>
        </Link>
        <Link href={`/companies/${companyId}?tab=commerciale`}>
          <Button type="button" size="sm" variant="outline">
            Commerciale
          </Button>
        </Link>
        <Link href={`/preventivi/new?company=${companyId}`}>
          <Button type="button" size="sm" variant="outline">
            <FileText className="h-4 w-4" />
            Nuovo preventivo
          </Button>
        </Link>
        <Link href={`/ordini/new?company=${companyId}`}>
          <Button type="button" size="sm" variant="outline">
            <ShoppingCart className="h-4 w-4" />
            Nuovo ordine
          </Button>
        </Link>
        <Link href={`/giro-visite?company=${companyId}`}>
          <Button type="button" size="sm" variant="outline">
            <Route className="h-4 w-4" />
            Apri Giro Visite
          </Button>
        </Link>
        <Link href={`/joy-ai?company=${companyId}`}>
          <Button type="button" size="sm" variant="outline">
            <Bot className="h-4 w-4" />
            Apri Joy AI
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface CompanyOverviewQuickActionsProps {
  phone: string | null;
  email: string | null;
  website: string | null;
  mapsUrl: string | null;
}

export function CompanyOverviewQuickActions({
  phone,
  email,
  website,
  mapsUrl,
}: CompanyOverviewQuickActionsProps) {
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <PhoneCall className="h-4 w-4" />
          Chiama
        </a>
      ) : (
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm text-slate-400">
          <Phone className="h-4 w-4" />
          Chiama
        </span>
      )}
      {email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Mail className="h-4 w-4" />
          Invia email
        </a>
      ) : (
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm text-slate-400">
          <Mail className="h-4 w-4" />
          Invia email
        </span>
      )}
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <MapPin className="h-4 w-4" />
          Apri Google Maps
        </a>
      ) : (
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm text-slate-400">
          <MapPin className="h-4 w-4" />
          Apri Google Maps
        </span>
      )}
      {websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Apri sito web
        </a>
      ) : (
        <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm text-slate-400">
          Apri sito web
        </span>
      )}
    </div>
  );
}
