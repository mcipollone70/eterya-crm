import "server-only";

import { cache } from "react";
import { daysSince } from "@/lib/commercial-priority/is-excluded";
import { computeCompanyPriorityFields } from "@/lib/commercial-priority/compute";
import {
  buildPriorityContextMaps,
  buildRowPriorityContext,
} from "@/lib/commercial-priority/context";
import type {
  PriorityContext,
  PriorityDashboardMetrics,
  CompanyPrioritySource,
} from "@/lib/commercial-priority/types";
import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";

const OPEN_OPPORTUNITY_STAGES = [
  "new",
  "contact_started",
  "site_visit",
  "quote_sent",
  "negotiation",
] as const;

/** ID aziende con opportunità aperta — memoizzato per richiesta. */
export const fetchOpenOpportunityCompanyIds = cache(async (): Promise<string[]> => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("company_id")
    .in("stage", [...OPEN_OPPORTUNITY_STAGES])
    .not("company_id", "is", null);

  if (error) {
    return [];
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => row.company_id)
        .filter((companyId): companyId is string => Boolean(companyId))
    ),
  ];
});

/**
 * Contesto priorità da colonne denormalizzate su `companies` (no scan visits/activities).
 */
export const fetchPriorityContext = cache(async (): Promise<PriorityContext> => {
  const supabase = await createServerClient();

  const [companiesRes, openOpportunityCompanies] = await Promise.all([
    supabase.from("companies").select("id,last_visit_at,last_contact_at"),
    fetchOpenOpportunityCompanyIds(),
  ]);

  const maps = buildPriorityContextMaps(companiesRes.data ?? [], openOpportunityCompanies);

  return {
    ...maps,
    openOpportunityCompanies,
  };
});

export async function getPriorityDashboardMetrics(): Promise<{
  data: PriorityDashboardMetrics | null;
  error: string | null;
}> {
  const supabase = await createServerClient();

  const [{ data, error }, openOpportunityCompanies] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id,name,status,commercial_status,revenue,import_payload,last_visit_at,last_contact_at"
      ),
    fetchOpenOpportunityCompanyIds(),
  ]);

  if (error) {
    return { data: null, error: describeDbError(error) };
  }

  const openOpportunitySet = new Set(openOpportunityCompanies);

  let highPriority = 0;
  let contactToday = 0;
  let inactiveClients90Days = 0;
  let unvisitedProspects = 0;

  for (const row of data ?? []) {
    const company = row as CompanyPrioritySource & {
      last_visit_at: string | null;
      last_contact_at: string | null;
    };
    const commercialStatus = normalizeCommercialStatus(company.commercial_status);
    const lastVisitAt = company.last_visit_at ?? null;
    const context = buildRowPriorityContext(
      company.id,
      lastVisitAt,
      company.last_contact_at ?? null,
      openOpportunitySet
    );
    const priority = computeCompanyPriorityFields(company, context);

    if (priority.priority_excluded) {
      continue;
    }

    if (priority.priority_tier === "high") {
      highPriority += 1;
    }

    if (commercialStatus === "da_ricontattare" && priority.priority_score >= 40) {
      contactToday += 1;
    }

    if (commercialStatus === "cliente") {
      const visitDays = daysSince(lastVisitAt);
      if (visitDays === null || visitDays > 90) {
        inactiveClients90Days += 1;
      }
    }

    if (commercialStatus === "prospect" && !lastVisitAt) {
      unvisitedProspects += 1;
    }
  }

  return {
    data: {
      highPriority,
      contactToday,
      inactiveClients90Days,
      unvisitedProspects,
    },
    error: null,
  };
}

export { buildRowPriorityContext };
