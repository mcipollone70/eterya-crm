import "server-only";

import { listContactHistory } from "@/features/activities/services/contact-history.service";
import { listFollowUps } from "@/features/activities/services/follow-ups.service";
import { getCompanyById } from "@/features/companies/services/companies.service";
import { getCompanyOpportunitySummary } from "@/features/opportunities/services/opportunities.service";
import { listCompanyProductInterests } from "@/features/products/services/company-product-interests.service";
import type { CompanyVisitBriefing } from "@/lib/commercial-assistant/types";
import { COMMERCIAL_STATUS_LABELS } from "@/lib/constants/commercial-status";
import { CONTACT_HISTORY_TYPE_LABELS } from "@/lib/constants/contact-history";
import { isContactHistoryType } from "@/lib/constants/contact-history";
import { FOLLOW_UP_PRIORITY_LABELS, FOLLOW_UP_STATUS_LABELS } from "@/lib/constants/follow-up";
import { isOpenOpportunityStage, OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { isProductFamily } from "@/lib/constants/product-catalog";

export async function getCompanyVisitBriefing(
  companyId: string
): Promise<{ data: CompanyVisitBriefing | null; error: string | null }> {
  const [
    companyResult,
    opportunitiesResult,
    productsResult,
    followUpsResult,
    contactsResult,
  ] = await Promise.all([
    getCompanyById(companyId),
    getCompanyOpportunitySummary(companyId),
    listCompanyProductInterests(companyId),
    listFollowUps({ companyId, limit: 20 }),
    listContactHistory({ companyId, limit: 6 }),
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

  return {
    data: {
      companyId: company.id,
      companyName: company.name,
      city: company.city,
      province: company.province,
      commercialStatus:
        COMMERCIAL_STATUS_LABELS[company.commercial_status] ?? company.commercial_status,
      notes: company.notes,
      internalNotes: company.internal_notes,
      lastVisit: {
        at: company.last_visit_at,
        outcome: company.last_visit_outcome,
        notes: company.last_visit_notes,
        durationMinutes: company.last_visit_duration_minutes,
        nextCallbackAt: company.next_callback_at,
      },
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
      products: { purchased, interests },
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
    },
    error: null,
  };
}
