import "server-only";

import { listContactHistory } from "@/features/activities/services/contact-history.service";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { getCompanyById } from "@/features/companies/services/companies.service";
import { listContactsByCompany } from "@/features/contacts/services/contacts.service";
import { getCompanyOpportunitySummary } from "@/features/opportunities/services/opportunities.service";
import {
  listCompanyProductInterestHistory,
  listCompanyProductInterests,
} from "@/features/products/services/company-product-interests.service";
import { listProducts } from "@/features/products/services/products.service";
import type { CompanyVisitBriefing } from "@/lib/commercial-assistant/types";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import { isContactHistoryType } from "@/lib/constants/contact-history";
import { FOLLOW_UP_PRIORITY_LABELS, FOLLOW_UP_STATUS_LABELS } from "@/lib/constants/follow-up";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import { isOpenOpportunityStage, OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS, isProductFamily } from "@/lib/constants/product-catalog";
import { createServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { generateBriefingSuggestions } from "../utils/generate-briefing-suggestions";

type CompanyRow = Tables<"companies">;

function resolveBriefingPhone(company: CompanyRow): string | null {
  return (
    company.phone ??
    company.contact_phone ??
    company.mobile ??
    company.phone_secondary ??
    null
  );
}

function resolveContactName(
  company: CompanyRow,
  primaryContactName: string | null
): string | null {
  return primaryContactName ?? company.contact_name ?? null;
}

function buildImportantNotes(company: CompanyRow): string[] {
  const notes: string[] = [];
  if (company.notes?.trim()) {
    notes.push(company.notes.trim());
  }
  if (company.internal_notes?.trim()) {
    notes.push(company.internal_notes.trim());
  }
  if (company.last_visit_notes?.trim()) {
    notes.push(`Ultima visita: ${company.last_visit_notes.trim()}`);
  }
  return notes;
}

async function getLastOrder(
  companyId: string
): Promise<CompanyVisitBriefing["lastOrder"]> {
  const supabase = await createServerClient();

  const [visitRes, historyResult] = await Promise.all([
    supabase
      .from("visits")
      .select("completed_at,outcome,notes")
      .eq("company_id", companyId)
      .eq("outcome", "ordine")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    listCompanyProductInterestHistory(companyId, 30),
  ]);

  const visitOrder = visitRes.data;
  const lastPurchase = historyResult.data.find(
    (item) => item.relation_type === "purchased" || item.event_type === "purchased"
  );

  const candidates: Array<{ at: string; label: string; notes: string | null }> = [];

  if (visitOrder?.completed_at) {
    candidates.push({
      at: visitOrder.completed_at,
      label: getVisitOutcomeLabel(visitOrder.outcome),
      notes: visitOrder.notes,
    });
  }

  if (lastPurchase) {
    candidates.push({
      at: lastPurchase.occurred_at,
      label: `Acquisto · ${lastPurchase.product_name}`,
      notes: lastPurchase.notes,
    });
  }

  if (candidates.length === 0) {
    return { at: null, label: null, notes: null };
  }

  candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const latest = candidates[0];

  return {
    at: latest.at,
    label: latest.label,
    notes: latest.notes,
  };
}

export async function getCompanyVisitBriefing(
  companyId: string
): Promise<{ data: CompanyVisitBriefing | null; error: string | null }> {
  const [
    companyResult,
    opportunitiesResult,
    productsResult,
    followUpsResult,
    contactsResult,
    companyContactsResult,
    catalogResult,
    lastOrder,
  ] = await Promise.all([
    getCompanyById(companyId),
    getCompanyOpportunitySummary(companyId),
    listCompanyProductInterests(companyId),
    listFollowUps({ companyId, limit: 20 }),
    listContactHistory({ companyId, limit: 6 }),
    listContactsByCompany(companyId),
    listProducts({ activeOnly: true }),
    getLastOrder(companyId),
  ]);

  if (companyResult.error || !companyResult.data) {
    return { data: null, error: companyResult.error ?? "Azienda non trovata." };
  }

  const company = companyResult.data;
  const products = productsResult.data ?? [];
  const purchased = products
    .filter((item) => item.relation_type === "purchased")
    .map((item) => ({
      name: item.product_name,
      family: isProductFamily(item.product_family)
        ? PRODUCT_FAMILY_LABELS[item.product_family]
        : item.product_family,
    }));
  const interests = products
    .filter((item) => item.relation_type === "interest")
    .map((item) => ({
      name: item.product_name,
      family: isProductFamily(item.product_family)
        ? PRODUCT_FAMILY_LABELS[item.product_family]
        : item.product_family,
      level: item.interest_level,
    }));

  const purchasedProductIds = new Set(
    products.filter((item) => item.relation_type === "purchased").map((item) => item.product_id)
  );
  const neverPurchased = (catalogResult.data ?? [])
    .filter((product) => !purchasedProductIds.has(product.id))
    .map((product) => ({
      name: product.name,
      family: PRODUCT_FAMILY_LABELS[product.family],
    }));

  const primaryContact =
    companyContactsResult.data.find((contact) => contact.is_primary) ??
    companyContactsResult.data[0] ??
    null;

  const openFollowUps = followUpsResult.data
    .filter((item) => item.status === "todo" || item.status === "postponed")
    .map((item) => ({
      id: item.id,
      activityType: isContactHistoryType(item.activity_type)
        ? CONTACT_HISTORY_TYPE_LABELS[item.activity_type]
        : item.activity_type,
      description: item.description,
      scheduledAt: item.effective_at,
      status: FOLLOW_UP_STATUS_LABELS[item.status],
      priority: FOLLOW_UP_PRIORITY_LABELS[item.priority],
    }));

  const opportunities = opportunitiesResult.data;
  const openItems = opportunities.items
    .filter((item) => isOpenOpportunityStage(item.stage))
    .map((item) => ({
      id: item.id,
      title: item.title,
      stage: OPPORTUNITY_STAGE_LABELS[item.stage] ?? item.stage,
      amount: item.total_amount,
      probability: item.probability,
    }));

  const briefingBase = {
    companyId: company.id,
    companyName: company.name,
    city: company.city,
    province: company.province,
    commercialStatus:
      COMMERCIAL_STATUS_LABELS[company.commercial_status] ?? company.commercial_status,
    contactName: resolveContactName(company, primaryContact?.full_name ?? null),
    phone: resolveBriefingPhone(company),
    latitude: company.latitude,
    longitude: company.longitude,
    notes: company.notes,
    internalNotes: company.internal_notes,
    importantNotes: buildImportantNotes(company),
    lastVisit: {
      at: company.last_visit_at,
      outcome: company.last_visit_outcome,
      notes: company.last_visit_notes,
      durationMinutes: company.last_visit_duration_minutes,
      nextCallbackAt: company.next_callback_at,
    },
    lastOrder,
    lastContact: {
      at: company.last_contact_at,
      type: company.last_contact_type,
    },
    opportunities: {
      openCount: opportunities.openCount,
      totalValue: opportunities.totalValue,
      averageProbability: opportunities.averageProbability,
      items: openItems,
    },
    products: { purchased, interests, neverPurchased },
    followUps: openFollowUps,
    recentContacts: contactsResult.data.map((item) => ({
      id: item.id,
      type: isContactHistoryType(item.type)
        ? CONTACT_HISTORY_TYPE_LABELS[item.type]
        : item.type,
      title: item.title,
      occurredAt: item.occurred_at,
      outcome: item.outcome,
    })),
  };

  return {
    data: {
      ...briefingBase,
      aiSuggestions: generateBriefingSuggestions(briefingBase),
    },
    error: null,
  };
}
