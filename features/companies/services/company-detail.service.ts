import "server-only";

import { listContactHistory } from "@/features/activities/services/contact-history.service";
import { fetchOpenOpportunityCompanyIds } from "@/features/companies/services/commercial-priority.service";
import { getCompanyOpportunitySummary } from "@/features/opportunities/services/opportunities.service";
import { listOrders } from "@/features/orders/services/orders.service";
import { listCompanyProductInterests } from "@/features/products/services/company-product-interests.service";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { listVisitsByCompany } from "@/features/visits/services/visits.service";
import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import { buildRowPriorityContext } from "@/lib/commercial-priority/context";
import type { PriorityTier } from "@/lib/commercial-priority/types";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { AttachmentEntityType, Tables } from "@/lib/supabase/types";
import type { Company } from "./companies.service";

export interface CompanyPriorityInfo {
  score: number;
  tier: PriorityTier;
  excluded: boolean;
}

export interface CompanyAttachmentItem {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface CompanyDetailStatistics {
  visitCount: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  callCount: number;
  emailCount: number;
  quoteCount: number;
  orderCount: number;
  totalOrderValue: number | null;
}

function daysSince(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export async function getCompanyPriorityInfo(company: Company): Promise<CompanyPriorityInfo> {
  const openOpportunityCompanyIds = await fetchOpenOpportunityCompanyIds();
  const openOpportunitySet = new Set(openOpportunityCompanyIds);
  const context = buildRowPriorityContext(
    company.id,
    company.last_visit_at ?? null,
    company.last_contact_at ?? null,
    openOpportunitySet
  );
  const priority = computeCompanyPriorityFields(company, context);

  return {
    score: priority.priority_score,
    tier: priority.priority_tier,
    excluded: priority.priority_excluded,
  };
}

export async function listCompanyAttachments(
  companyId: string
): Promise<{ data: CompanyAttachmentItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const entityType: AttachmentEntityType = "company";

  const { data, error } = await supabase
    .from("attachments")
    .select("id,file_name,mime_type,file_size,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (/attachments|relation|does not exist/i.test(error.message)) {
      return { data: [], error: null };
    }
    return { data: [], error: describeDbError(error) };
  }

  return { data: (data ?? []) as CompanyAttachmentItem[], error: null };
}

export async function getCompanyDetailStatistics(
  companyId: string
): Promise<{ data: CompanyDetailStatistics; error: string | null }> {
  const [visitsResult, historyResult, quotesResult, ordersResult] = await Promise.all([
    listVisitsByCompany(companyId),
    listContactHistory({ companyId, limit: 500 }),
    listQuotes({ filters: { companyId }, limit: 500 }),
    listOrders({ filters: { companyId }, limit: 500 }),
  ]);

  const visits = visitsResult.data.filter((visit) => visit.status === "completed");
  const history = historyResult.data;
  const lastVisitAt =
    visits[0]?.completed_at ??
    visits[0]?.scheduled_at ??
    null;

  const callCount = history.filter((item) => item.type === "call" || item.type === "whatsapp").length;
  const emailCount = history.filter((item) => item.type === "email").length;
  // Quotes list excludes stage=won (converted orders); orders list is the source of truth for won.
  const quoteCount = quotesResult.count ?? quotesResult.data.length;
  const orderCount = ordersResult.count ?? ordersResult.data.length;
  const totalOrderValue =
    orderCount > 0
      ? ordersResult.data.reduce((sum, item) => sum + item.total_amount, 0)
      : null;

  return {
    data: {
      visitCount: visits.length,
      lastVisitAt,
      daysSinceLastVisit: daysSince(lastVisitAt),
      callCount,
      emailCount,
      quoteCount,
      orderCount,
      totalOrderValue,
    },
    error:
      visitsResult.error ??
      historyResult.error ??
      quotesResult.error ??
      ordersResult.error,
  };
}

export async function listCompanyActivities(
  companyId: string,
  period?: "today" | "week" | "month" | null
): Promise<{
  data: Awaited<ReturnType<typeof listContactHistory>>["data"];
  error: string | null;
}> {
  const { data, error } = await listContactHistory({
    companyId,
    period: period ?? null,
    limit: 200,
  });

  return { data, error };
}

export async function listCompanyVisitsWithContext(companyId: string) {
  const [visitsResult, interestsResult, opportunitiesResult] = await Promise.all([
    listVisitsByCompany(companyId),
    listCompanyProductInterests(companyId),
    getCompanyOpportunitySummary(companyId),
  ]);

  const productNames = interestsResult.data
    .filter((item) => item.relation_type === "interest")
    .map((item) => item.product_name);

  const openProbability =
    opportunitiesResult.data.items.find((item) => item.probability != null)?.probability ?? null;

  return {
    visits: visitsResult.data,
    productNames,
    saleProbability: openProbability,
    error: visitsResult.error ?? interestsResult.error ?? opportunitiesResult.error,
  };
}

export async function getCompanyNotesSnapshot(companyId: string): Promise<{
  data: Pick<Tables<"companies">, "notes" | "internal_notes" | "updated_at"> | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("notes,internal_notes,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  return { data: data ?? null, error: describeDbError(error) };
}
