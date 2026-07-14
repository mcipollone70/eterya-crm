import "server-only";

import type { BadgeVariant } from "@/components/ui/badge";
import {
  COMMERCIAL_STATUS_BADGE_VARIANT,
  COMMERCIAL_STATUS_LABELS,
  normalizeCommercialStatus,
} from "@/lib/constants/commercial-status";
import {
  CONTACT_HISTORY_TYPE_LABELS,
  isContactHistoryType,
} from "@/lib/constants/contact-history";
import { FOLLOW_UP_STATUS_LABELS } from "@/lib/constants/follow-up";
import {
  isOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/constants/opportunity-pipeline";
import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
} from "@/lib/constants/product-catalog";
import { toDateKey } from "@/lib/agenda/calendar";
import { formatVisitDateShort } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import type { CommercialStatus, VisitStatus } from "@/lib/supabase/types";
import {
  GLOBAL_SEARCH_CATEGORY_LABELS,
  GLOBAL_SEARCH_CATEGORY_ORDER,
  type GlobalSearchCategory,
  type GlobalSearchGroup,
  type GlobalSearchResponse,
  type GlobalSearchResult,
} from "../types";
import { escapeIlikePattern } from "../utils/escape-ilike";

const PER_CATEGORY_LIMIT = 3;
const MAX_TOTAL_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "Pianificata",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
  no_show: "Assente",
};

const VISIT_STATUS_VARIANT: Record<VisitStatus, BadgeVariant> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "muted",
  no_show: "danger",
};

const FOLLOW_UP_STATUS_VARIANT: Record<string, BadgeVariant> = {
  todo: "info",
  completed: "success",
  postponed: "warning",
  cancelled: "muted",
};

const OPPORTUNITY_STAGE_VARIANT: Record<string, BadgeVariant> = {
  won: "success",
  lost: "danger",
  negotiation: "warning",
  quote_sent: "info",
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type CompanySearchRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  vat_number: string | null;
  email: string | null;
  commercial_status: CommercialStatus | null;
};

type ContactSearchRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  is_primary: boolean;
  company: { name: string } | { name: string }[] | null;
};

type OpportunitySearchRow = {
  id: string;
  title: string;
  stage: string;
  company_id: string;
  companies: { name: string } | { name: string }[] | null;
};

type VisitSearchRow = {
  id: string;
  company_id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  outcome: string | null;
  companies: { name: string; city: string | null } | Array<{ name: string; city: string | null }> | null;
};

type FollowUpSearchRow = {
  id: string;
  company_id: string;
  activity_type: string;
  description: string | null;
  status: string;
  scheduled_at: string;
  companies: { name: string } | { name: string }[] | null;
};

type ReminderSearchRow = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  scheduled_at: string;
  company_id: string | null;
  companies: { name: string } | { name: string }[] | null;
};

type ProductSearchRow = {
  id: string;
  name: string;
  sku: string | null;
  family: string;
  category: string | null;
  is_active: boolean;
};

function agendaHref(scheduledAt: string): string {
  return `/agenda?view=day&date=${toDateKey(new Date(scheduledAt))}`;
}

function buildOrFilter(fields: string[], pattern: string): string {
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

function capResults(
  buckets: Partial<Record<GlobalSearchCategory, GlobalSearchResult[]>>
): GlobalSearchGroup[] {
  const groups: GlobalSearchGroup[] = [];
  let remaining = MAX_TOTAL_RESULTS;

  for (const category of GLOBAL_SEARCH_CATEGORY_ORDER) {
    if (remaining <= 0) {
      break;
    }
    const items = buckets[category] ?? [];
    if (items.length === 0) {
      continue;
    }
    const slice = items.slice(0, remaining);
    remaining -= slice.length;
    groups.push({
      category,
      label: GLOBAL_SEARCH_CATEGORY_LABELS[category],
      results: slice,
    });
  }

  return groups;
}

async function searchCompanies(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,city,province,vat_number,email,commercial_status")
    .or(
      buildOrFilter(
        [
          "name",
          "legal_name",
          "vat_number",
          "tax_code",
          "email",
          "phone",
          "mobile",
          "city",
          "contact_email",
          "contact_phone",
        ],
        pattern
      )
    )
    .order("name", { ascending: true })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as CompanySearchRow[]).map((row) => {
    const commercialStatus = normalizeCommercialStatus(row.commercial_status);
    const subtitleParts = [row.city, row.province].filter(Boolean);
    if (row.vat_number) {
      subtitleParts.push(`P.IVA ${row.vat_number}`);
    } else if (row.email) {
      subtitleParts.push(row.email);
    }

    return {
      id: row.id,
      category: "company" as const,
      title: row.name,
      subtitle: subtitleParts.join(" · ") || null,
      statusLabel: COMMERCIAL_STATUS_LABELS[commercialStatus],
      statusVariant: COMMERCIAL_STATUS_BADGE_VARIANT[commercialStatus],
      href: `/companies/${row.id}`,
      quickActionLabel: "Apri scheda",
    };
  });
}

async function searchContacts(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id,full_name,email,phone,mobile,role,is_primary,company:companies(name)")
    .or(buildOrFilter(["full_name", "email", "phone", "mobile", "role"], pattern))
    .order("full_name", { ascending: true })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as ContactSearchRow[]).map((row) => {
    const company = relationOne(row.company);
    const subtitleParts = [company?.name, row.email, row.phone ?? row.mobile, row.role].filter(
      Boolean
    );

    return {
      id: row.id,
      category: "contact" as const,
      title: row.full_name,
      subtitle: subtitleParts.join(" · ") || null,
      statusLabel: row.is_primary ? "Primario" : "Contatto",
      statusVariant: row.is_primary ? "success" : "muted",
      href: `/contacts/${row.id}`,
      quickActionLabel: "Apri contatto",
    };
  });
}

async function searchOpportunities(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("id,title,stage,company_id,companies(name)")
    .or(
      buildOrFilter(
        ["title", "product_interest", "notes", "companies.name"],
        pattern
      )
    )
    .order("updated_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as OpportunitySearchRow[]).map((row) => {
    const company = relationOne(row.companies);
    const stage = isOpportunityStage(row.stage) ? row.stage : "new";

    return {
      id: row.id,
      category: "opportunity" as const,
      title: row.title,
      subtitle: company?.name ?? null,
      statusLabel: OPPORTUNITY_STAGE_LABELS[stage],
      statusVariant: OPPORTUNITY_STAGE_VARIANT[stage] ?? "info",
      href: "/opportunities",
      quickActionLabel: "Vedi opportunità",
    };
  });
}

async function searchVisits(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("visits")
    .select("id,company_id,scheduled_at,status,notes,outcome,companies(name,city)")
    .or(
      buildOrFilter(["notes", "outcome", "companies.name"], pattern)
    )
    .order("scheduled_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as VisitSearchRow[]).map((row) => {
    const company = relationOne(row.companies);
    const status = row.status as VisitStatus;
    const subtitleParts = [
      company?.name,
      company?.city,
      formatVisitDateShort(row.scheduled_at),
      row.outcome,
    ].filter(Boolean);

    return {
      id: row.id,
      category: "visit" as const,
      title: company?.name ? `Visita · ${company.name}` : "Visita pianificata",
      subtitle: subtitleParts.join(" · ") || row.notes,
      statusLabel: VISIT_STATUS_LABELS[status] ?? status,
      statusVariant: VISIT_STATUS_VARIANT[status] ?? "muted",
      href: row.company_id ? `/visits?company=${row.company_id}` : "/visits",
      quickActionLabel: "Vedi visita",
    };
  });
}

async function searchFollowUps(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id,company_id,activity_type,description,status,scheduled_at,companies(name)")
    .or(buildOrFilter(["description", "companies.name"], pattern))
    .order("scheduled_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as FollowUpSearchRow[]).map((row) => {
    const company = relationOne(row.companies);
    const activityType = isContactHistoryType(row.activity_type)
      ? row.activity_type
      : "call";
    const status = row.status as keyof typeof FOLLOW_UP_STATUS_LABELS;

    return {
      id: row.id,
      category: "follow_up" as const,
      title: CONTACT_HISTORY_TYPE_LABELS[activityType],
      subtitle: [company?.name, row.description, formatVisitDateShort(row.scheduled_at)]
        .filter(Boolean)
        .join(" · ") || null,
      statusLabel: FOLLOW_UP_STATUS_LABELS[status] ?? status,
      statusVariant: FOLLOW_UP_STATUS_VARIANT[status] ?? "muted",
      href: row.company_id
        ? `/activities?section=followups&fcompany=${row.company_id}`
        : "/activities?section=followups",
      quickActionLabel: "Vedi attività",
    };
  });
}

async function searchReminders(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("agenda_reminders")
    .select("id,title,notes,status,scheduled_at,company_id,companies(name)")
    .or(buildOrFilter(["title", "notes", "companies.name"], pattern))
    .order("scheduled_at", { ascending: false })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as ReminderSearchRow[]).map((row) => {
    const company = relationOne(row.companies);
    const status = row.status as keyof typeof FOLLOW_UP_STATUS_LABELS;

    return {
      id: row.id,
      category: "reminder" as const,
      title: row.title,
      subtitle: [company?.name, row.notes, formatVisitDateShort(row.scheduled_at)]
        .filter(Boolean)
        .join(" · ") || null,
      statusLabel: FOLLOW_UP_STATUS_LABELS[status] ?? status,
      statusVariant: FOLLOW_UP_STATUS_VARIANT[status] ?? "warning",
      href: agendaHref(row.scheduled_at),
      quickActionLabel: "Vedi agenda",
    };
  });
}

async function searchProducts(pattern: string): Promise<GlobalSearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,family,category,is_active")
    .or(buildOrFilter(["name", "sku", "description", "category", "notes"], pattern))
    .order("name", { ascending: true })
    .limit(PER_CATEGORY_LIMIT);

  if (error || !data) {
    return [];
  }

  return (data as ProductSearchRow[]).map((row) => {
    const family = isProductFamily(row.family) ? row.family : null;
    const subtitleParts = [row.sku, row.category, family ? PRODUCT_FAMILY_LABELS[family] : null].filter(
      Boolean
    );

    return {
      id: row.id,
      category: "product" as const,
      title: row.name,
      subtitle: subtitleParts.join(" · ") || null,
      statusLabel: row.is_active ? "Attivo" : "Inattivo",
      statusVariant: row.is_active ? "success" : "muted",
      href: "/products",
      quickActionLabel: "Vedi prodotti",
    };
  });
}

export async function globalSearch(query: string): Promise<GlobalSearchResponse> {
  const pattern = escapeIlikePattern(query);
  if (!pattern || query.trim().length < MIN_QUERY_LENGTH) {
    return { groups: [], total: 0, error: null };
  }

  const [
    companies,
    contacts,
    opportunities,
    visits,
    followUps,
    reminders,
    products,
  ] = await Promise.all([
    searchCompanies(pattern),
    searchContacts(pattern),
    searchOpportunities(pattern),
    searchVisits(pattern),
    searchFollowUps(pattern),
    searchReminders(pattern),
    searchProducts(pattern),
  ]);

  const groups = capResults({
    company: companies,
    contact: contacts,
    opportunity: opportunities,
    visit: visits,
    follow_up: followUps,
    reminder: reminders,
    product: products,
  });

  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.results.length, 0),
    error: null,
  };
}

export async function globalSearchSafe(query: string): Promise<GlobalSearchResponse> {
  try {
    return await globalSearch(query);
  } catch (error) {
    return {
      groups: [],
      total: 0,
      error: error instanceof Error ? error.message : "Ricerca non riuscita.",
    };
  }
}
