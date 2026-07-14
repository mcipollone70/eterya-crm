import "server-only";

import { cache } from "react";
import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import {
  CLOSED_LOST_STAGE,
  CLOSED_WON_STAGE,
  isOpenOpportunityStage,
  isOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
  OPEN_OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { groupOpportunitiesByStage as groupOpportunityItemsByStage } from "@/lib/opportunities/kanban";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { OpportunityStatus, Tables } from "@/lib/supabase/types";

export type Opportunity = Tables<"opportunities">;

export interface OpportunityListItem {
  id: string;
  company_id: string;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  user_id: string;
  title: string;
  product_interest: string | null;
  product_family: ProductFamily;
  product_ids: string[];
  product_names: string[];
  total_amount: number;
  currency: string;
  probability: number | null;
  stage: OpportunityStage;
  status: OpportunityStatus;
  opened_at: string;
  expected_close_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityStageHistoryItem {
  id: string;
  from_stage: OpportunityStage | null;
  to_stage: OpportunityStage;
  changed_at: string;
  changed_by_name: string | null;
  notes: string | null;
}

export interface SaveOpportunityInput {
  companyId: string;
  contactId?: string | null;
  title: string;
  productInterest?: string | null;
  productFamily: ProductFamily;
  productIds?: string[];
  estimatedValue?: number;
  probability?: number | null;
  stage?: OpportunityStage;
  expectedCloseAt?: string | null;
  notes?: string | null;
}

export interface UpdateOpportunityInput extends SaveOpportunityInput {
  stage?: OpportunityStage;
}

export interface CompanyOpportunitySummary {
  openCount: number;
  totalValue: number;
  averageProbability: number;
  items: OpportunityListItem[];
}

export interface OpportunityDashboardMetrics {
  openCount: number;
  pipelineValue: number;
  wonCount: number;
  lostCount: number;
}

const OPPORTUNITY_SELECT =
  "id,company_id,contact_id,user_id,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(product_id,products(id,name))";

const LEGACY_OPPORTUNITY_SELECT =
  "id,company_id,contact_id,user_id,title,product_interest,total_amount,currency,status,notes,created_at,updated_at,companies(name),contacts(full_name)";

type OpportunityRow = {
  id: string;
  company_id: string;
  contact_id?: string | null;
  user_id: string;
  title: string;
  product_interest: string | null;
  product_family?: string | null;
  total_amount: number;
  currency: string;
  probability?: number | null;
  stage?: string | null;
  status: OpportunityStatus;
  opened_at?: string | null;
  expected_close_at?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  companies: { name: string } | { name: string }[] | null;
  contacts?: { full_name: string } | { full_name: string }[] | null;
  opportunity_products?:
    | { product_id: string; products: { id: string; name: string } | { id: string; name: string }[] | null }[]
    | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function stageFromLegacyStatus(status: OpportunityStatus): OpportunityStage {
  if (status === "accepted") {
    return CLOSED_WON_STAGE;
  }
  if (status === "rejected" || status === "cancelled") {
    return CLOSED_LOST_STAGE;
  }
  if (status === "sent") {
    return "quote_sent";
  }
  return "new";
}

function resolveOpportunityStage(row: {
  stage?: string | null;
  status: OpportunityStatus;
}): OpportunityStage {
  if (row.stage && isOpportunityStage(row.stage)) {
    return row.stage;
  }
  return stageFromLegacyStatus(row.status);
}

const DEFAULT_PRODUCT_FAMILY: ProductFamily = "zanzariere";

function resolveProductFamily(row: { product_family?: string | null }): ProductFamily {
  if (row.product_family && isProductFamily(row.product_family)) {
    return row.product_family;
  }
  return DEFAULT_PRODUCT_FAMILY;
}

function mapOpportunityRow(row: OpportunityRow): OpportunityListItem {
  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const linkedProducts = row.opportunity_products ?? [];
  const productIds: string[] = [];
  const productNames: string[] = [];

  for (const link of linkedProducts) {
    const product = relationOne(link.products);
    if (product?.id) {
      productIds.push(product.id);
      productNames.push(product.name);
    }
  }

  const stage = resolveOpportunityStage(row);
  const productFamily = resolveProductFamily(row);

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    contact_id: row.contact_id ?? null,
    contact_name: contact?.full_name ?? null,
    user_id: row.user_id,
    title: row.title,
    product_interest: row.product_interest,
    product_family: productFamily,
    product_ids: productIds,
    product_names: productNames,
    total_amount: Number(row.total_amount),
    currency: row.currency,
    probability: row.probability ?? null,
    stage,
    status: row.status,
    opened_at: row.opened_at ?? row.created_at,
    expected_close_at: row.expected_close_at ?? null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resolveOpportunityUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function legacyStatusForStage(stage: OpportunityStage): OpportunityStatus {
  if (stage === CLOSED_WON_STAGE) {
    return "accepted";
  }
  if (stage === CLOSED_LOST_STAGE) {
    return "rejected";
  }
  if (stage === "quote_sent") {
    return "sent";
  }
  return "draft";
}

async function resolveValidContactId(
  companyId: string,
  contactId: string | null | undefined
): Promise<{ contactId: string | null; error: string | null }> {
  if (!contactId) {
    return { contactId: null, error: null };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return { contactId: null, error: describeDbError(error) };
  }

  if (!data) {
    return {
      contactId: null,
      error: "Il referente selezionato non appartiene a questa azienda.",
    };
  }

  return { contactId, error: null };
}

async function replaceOpportunityProducts(
  opportunityId: string,
  productIds: string[] | undefined
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error: deleteError } = await supabase
    .from("opportunity_products")
    .delete()
    .eq("opportunity_id", opportunityId);

  if (deleteError) {
    return { error: describeDbError(deleteError) };
  }

  if (!productIds || productIds.length === 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase.from("opportunity_products").insert(
    productIds.map((productId) => ({
      opportunity_id: opportunityId,
      product_id: productId,
    }))
  );

  return { error: describeDbError(insertError) };
}

export async function listOpportunities(options?: {
  companyId?: string;
  limit?: number;
}): Promise<{ data: OpportunityListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let countQuery = supabase.from("opportunities").select("id", { count: "exact", head: true });
  if (options?.companyId) {
    countQuery = countQuery.eq("company_id", options.companyId);
  }
  const countResult = await countQuery;

  async function runQuery(select: string) {
    let query = supabase
      .from("opportunities")
      .select(select)
      .order("updated_at", { ascending: false })
      .limit(options?.limit ?? 500);

    if (options?.companyId) {
      query = query.eq("company_id", options.companyId);
    }

    return query;
  }

  let result = await runQuery(OPPORTUNITY_SELECT);
  if (
    result.error &&
    /stage|product_family|opportunity_products|probability|opened_at|expected_close_at|contact_id/i.test(
      result.error.message
    )
  ) {
    result = await runQuery(LEGACY_OPPORTUNITY_SELECT);
  }

  if (result.error) {
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) =>
    mapOpportunityRow(row as unknown as OpportunityRow)
  );

  return {
    data: items,
    count: countResult.count ?? items.length,
    error: null,
  };
}

export async function getCompanyOpportunitySummary(
  companyId: string
): Promise<{ data: CompanyOpportunitySummary; error: string | null }> {
  const { data, error } = await listOpportunities({ companyId, limit: 200 });
  if (error) {
    return {
      data: { openCount: 0, totalValue: 0, averageProbability: 0, items: [] },
      error,
    };
  }

  const openItems = data.filter((item) => isOpenOpportunityStage(item.stage));
  const totalValue = openItems.reduce((sum, item) => sum + item.total_amount, 0);
  const probabilities = openItems
    .map((item) => item.probability)
    .filter((value): value is number => value != null);
  const averageProbability =
    probabilities.length > 0
      ? Math.round(probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length)
      : 0;

  return {
    data: {
      openCount: openItems.length,
      totalValue,
      averageProbability,
      items: data,
    },
    error: null,
  };
}

export async function saveOpportunity(
  input: SaveOpportunityInput
): Promise<{ opportunityId: string | null; error: string | null }> {
  const userId = await resolveOpportunityUserId();
  if (!userId) {
    return { opportunityId: null, error: "Utente non autenticato." };
  }

  const stage = input.stage ?? "new";
  const productFamily = input.productFamily;
  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { contactId, error: contactError } = await resolveValidContactId(
    input.companyId,
    input.contactId
  );
  if (contactError) {
    return { opportunityId: null, error: contactError };
  }

  const productNames: string[] = [];
  if (input.productIds && input.productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id,name")
      .in("id", input.productIds);
    for (const product of products ?? []) {
      productNames.push(product.name);
    }
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      company_id: input.companyId,
      contact_id: contactId,
      user_id: userId,
      title: input.title.trim(),
      product_interest:
        input.productInterest?.trim() ||
        (productNames.length > 0 ? productNames.join(", ") : PRODUCT_FAMILY_LABELS[productFamily]),
      product_family: productFamily,
      total_amount: input.estimatedValue ?? 0,
      probability: input.probability ?? 50,
      stage,
      status: legacyStatusForStage(stage),
      opened_at: now,
      expected_close_at: input.expectedCloseAt ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { opportunityId: null, error: describeDbError(error) };
  }

  if (input.productIds && input.productIds.length > 0) {
    const { error: productsError } = await replaceOpportunityProducts(data.id, input.productIds);
    if (productsError) {
      return { opportunityId: null, error: productsError };
    }
  }

  await supabase.from("opportunity_stage_history").insert({
    opportunity_id: data.id,
    from_stage: null,
    to_stage: stage,
    changed_by: userId,
    notes: "Opportunità creata",
  });

  return { opportunityId: data.id, error: null };
}

export async function getOpportunityById(id: string): Promise<OpportunityListItem | null> {
  const supabase = await createServerClient();
  let result = await supabase.from("opportunities").select(OPPORTUNITY_SELECT).eq("id", id).maybeSingle();

  if (
    result.error &&
    /stage|product_family|opportunity_products|probability|opened_at|expected_close_at|contact_id/i.test(
      result.error.message
    )
  ) {
    result = await supabase
      .from("opportunities")
      .select(LEGACY_OPPORTUNITY_SELECT)
      .eq("id", id)
      .maybeSingle();
  }

  if (result.error || !result.data) {
    return null;
  }

  return mapOpportunityRow(result.data as unknown as OpportunityRow);
}

export async function listOpportunityStageHistory(
  opportunityId: string
): Promise<{ data: OpportunityStageHistoryItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunity_stage_history")
    .select("id,from_stage,to_stage,changed_at,notes,users(full_name)")
    .eq("opportunity_id", opportunityId)
    .order("changed_at", { ascending: false });

  if (error) {
    if (/opportunity_stage_history/i.test(error.message)) {
      return { data: [], error: null };
    }
    return { data: [], error: describeDbError(error) };
  }

  const items = (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      from_stage: OpportunityStage | null;
      to_stage: OpportunityStage;
      changed_at: string;
      notes: string | null;
      users: { full_name: string } | { full_name: string }[] | null;
    };
    const user = relationOne(typed.users);
    return {
      id: typed.id,
      from_stage: typed.from_stage,
      to_stage: typed.to_stage,
      changed_at: typed.changed_at,
      changed_by_name: user?.full_name ?? null,
      notes: typed.notes,
    };
  });

  return { data: items, error: null };
}

export async function updateOpportunity(
  opportunityId: string,
  input: UpdateOpportunityInput
): Promise<{ error: string | null }> {
  const opportunity = await getOpportunityById(opportunityId);
  if (!opportunity) {
    return { error: "Opportunità non trovata." };
  }

  const userId = await resolveOpportunityUserId();
  const stage = input.stage ?? opportunity.stage;
  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { contactId, error: contactError } = await resolveValidContactId(
    opportunity.company_id,
    input.contactId
  );
  if (contactError) {
    return { error: contactError };
  }

  const productNames: string[] = [];
  if (input.productIds && input.productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id,name")
      .in("id", input.productIds);
    for (const product of products ?? []) {
      productNames.push(product.name);
    }
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      contact_id: contactId,
      title: input.title.trim(),
      product_interest:
        input.productInterest?.trim() ||
        (productNames.length > 0 ? productNames.join(", ") : PRODUCT_FAMILY_LABELS[input.productFamily]),
      product_family: input.productFamily,
      total_amount: input.estimatedValue ?? 0,
      probability: input.probability ?? 50,
      stage,
      status: legacyStatusForStage(stage),
      expected_close_at: input.expectedCloseAt ?? null,
      notes: input.notes?.trim() || null,
      updated_at: now,
      ...(stage === CLOSED_WON_STAGE ? { accepted_at: now } : {}),
    })
    .eq("id", opportunityId);

  if (error) {
    return { error: describeDbError(error) };
  }

  const { error: productsError } = await replaceOpportunityProducts(
    opportunityId,
    input.productIds
  );
  if (productsError) {
    return { error: productsError };
  }

  if (opportunity.stage !== stage) {
    await supabase.from("opportunity_stage_history").insert({
      opportunity_id: opportunityId,
      from_stage: opportunity.stage,
      to_stage: stage,
      changed_by: userId,
      changed_at: now,
      notes: "Aggiornamento da scheda opportunità",
    });
  }

  return { error: null };
}

export async function deleteOpportunity(
  opportunityId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("opportunities").delete().eq("id", opportunityId);
  return { error: describeDbError(error) };
}

export async function updateOpportunityStage(
  opportunityId: string,
  nextStage: OpportunityStage,
  notes?: string | null
): Promise<{ success: boolean; message: string }> {
  if (!isOpportunityStage(nextStage)) {
    return { success: false, message: "Fase non valida." };
  }

  const opportunity = await getOpportunityById(opportunityId);
  if (!opportunity) {
    return { success: false, message: "Opportunità non trovata." };
  }

  if (opportunity.stage === nextStage) {
    return { success: true, message: "Fase già aggiornata." };
  }

  const userId = await resolveOpportunityUserId();
  const changedAt = new Date().toISOString();
  const supabase = await createServerClient();

  const updatePayload: {
    stage: OpportunityStage;
    status: OpportunityStatus;
    updated_at: string;
    accepted_at?: string;
  } = {
    stage: nextStage,
    status: legacyStatusForStage(nextStage),
    updated_at: changedAt,
  };

  if (nextStage === CLOSED_WON_STAGE) {
    updatePayload.accepted_at = changedAt;
  }

  const { error } = await supabase
    .from("opportunities")
    .update(updatePayload)
    .eq("id", opportunityId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  await supabase.from("opportunity_stage_history").insert({
    opportunity_id: opportunityId,
    from_stage: opportunity.stage,
    to_stage: nextStage,
    changed_by: userId,
    changed_at: changedAt,
    notes: notes?.trim() || null,
  });

  const fromLabel = OPPORTUNITY_STAGE_LABELS[opportunity.stage];
  const toLabel = OPPORTUNITY_STAGE_LABELS[nextStage];

  await saveContactHistoryActivity({
    companyId: opportunity.company_id,
    type: "quote",
    title: `Opportunità: ${opportunity.title}`,
    description: `Fase aggiornata da "${fromLabel}" a "${toLabel}".${
      notes?.trim() ? ` ${notes.trim()}` : ""
    }`,
    occurredAt: changedAt,
    source: "manual",
  });

  return { success: true, message: `Fase aggiornata a ${toLabel}.` };
}

export const getOpportunityDashboardMetrics = cache(async (): Promise<{
  data: OpportunityDashboardMetrics | null;
  error: string | null;
}> => {
  const supabase = await createServerClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_opportunity_dashboard_metrics" as never
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        openCount: Number(row.openCount ?? 0),
        pipelineValue: Number(row.pipelineValue ?? 0),
        wonCount: Number(row.wonCount ?? 0),
        lostCount: Number(row.lostCount ?? 0),
      },
      error: null,
    };
  }

  const { count: openCount, error: openCountError } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("stage", [...OPEN_OPPORTUNITY_STAGES]);

  const { count: wonCount, error: wonError } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("stage", CLOSED_WON_STAGE);

  const { count: lostCount, error: lostError } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("stage", CLOSED_LOST_STAGE);

  const aggregateError = openCountError ?? wonError ?? lostError;
  if (aggregateError) {
    return { data: null, error: describeDbError(aggregateError) };
  }

  let pipelineValue = 0;
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: valueBatch, error: valueError } = await supabase
      .from("opportunities")
      .select("total_amount")
      .in("stage", [...OPEN_OPPORTUNITY_STAGES])
      .range(offset, offset + batchSize - 1);

    if (valueError) {
      return { data: null, error: describeDbError(valueError) };
    }

    const rows = valueBatch ?? [];
    pipelineValue += rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

    if (rows.length < batchSize) {
      break;
    }

    offset += batchSize;
  }

  return {
    data: {
      openCount: openCount ?? 0,
      pipelineValue,
      wonCount: wonCount ?? 0,
      lostCount: lostCount ?? 0,
    },
    error: null,
  };
});

export { groupOpportunityItemsByStage as groupOpportunitiesByStage };
export { OPEN_OPPORTUNITY_STAGES };
