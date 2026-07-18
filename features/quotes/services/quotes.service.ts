import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import {
  listPipelineFilterOptions,
  type OpportunityListItem,
} from "@/features/opportunities/services/opportunities.service";
import {
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import type { QuoteFilters } from "@/lib/constants/quotes";
import type { CommercialLineItem } from "@/lib/constants/commercial-lines";
import { calcDocumentTotal } from "@/lib/constants/commercial-lines";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { OpportunityStatus } from "@/lib/supabase/types";
import type { SaveQuoteInput, UpdateQuoteInput } from "../types";
import { saveOrder } from "@/features/orders/services/orders.service";
import {
  logOpportunityChange,
  listOpportunityChangeHistory,
  mapOpportunityProductRows,
  nextDocumentNumber,
  replaceOpportunityLines,
} from "./commercial-document.service";

export type { SaveQuoteInput, UpdateQuoteInput };

export interface QuoteListItem extends OpportunityListItem {
  number: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  order_status: string | null;
  lines: CommercialLineItem[];
  next_action: string | null;
}

const QUOTE_SELECT =
  "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,valid_until,sent_at,accepted_at,order_status,notes,next_action,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(id,product_id,quantity,unit_price,discount_percent,vat_rate,line_total,description,sort_order,products(id,name,unit_price))";

type QuoteRow = {
  id: string;
  company_id: string;
  contact_id?: string | null;
  user_id: string;
  number?: string | null;
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
  valid_until?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  order_status?: string | null;
  notes: string | null;
  next_action?: string | null;
  created_at: string;
  updated_at: string;
  companies: { name: string } | { name: string }[] | null;
  contacts?: { full_name: string } | { full_name: string }[] | null;
  opportunity_products?:
    | {
        id?: string | null;
        product_id: string;
        quantity?: number | null;
        unit_price?: number | null;
        discount_percent?: number | null;
        vat_rate?: number | null;
        line_total?: number | null;
        description?: string | null;
        sort_order?: number | null;
        products: { id: string; name: string; unit_price?: number | null } | { id: string; name: string; unit_price?: number | null }[] | null;
      }[]
    | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveStage(row: { stage?: string | null; status: OpportunityStatus }): OpportunityStage {
  const stages = OPPORTUNITY_STAGE_LABELS as Record<string, string>;
  if (row.stage && row.stage in stages) {
    return row.stage as OpportunityStage;
  }
  if (row.status === "accepted") return "won";
  if (row.status === "rejected" || row.status === "cancelled") return "lost";
  if (row.status === "sent") return "quote_sent";
  return "new";
}

function mapQuoteRow(row: QuoteRow): QuoteListItem {
  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const lines = mapOpportunityProductRows(row.opportunity_products);
  const productIds = lines.map((line) => line.productId);
  const productNames = lines.map((line) => line.productName).filter(Boolean) as string[];

  const productFamily =
    row.product_family && isProductFamily(row.product_family)
      ? row.product_family
      : ("zanzariere" as ProductFamily);

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
    stage: resolveStage(row),
    status: row.status,
    opened_at: row.opened_at ?? row.created_at,
    expected_close_at: row.expected_close_at ?? null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    number: row.number ?? null,
    valid_until: row.valid_until ?? null,
    sent_at: row.sent_at ?? null,
    accepted_at: row.accepted_at ?? null,
    order_status: row.order_status ?? null,
    lines,
    next_action: row.next_action ?? null,
  };
}

function applyQuoteFiltersToQuery<T extends {
  eq: (column: string, value: string) => T;
  neq: (column: string, value: string) => T;
}>(query: T, filters?: QuoteFilters, options?: { includeWon?: boolean }): T {
  // Accepted quotes are stage=won; include them when filtering by accepted or when asked.
  const includeWon = options?.includeWon || filters?.status === "accepted";
  if (!includeWon) {
    query = query.neq("stage", "won");
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  return query;
}

export async function listQuotes(options?: {
  filters?: QuoteFilters;
  limit?: number;
  includeWon?: boolean;
}): Promise<{ data: QuoteListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let countQuery = supabase.from("opportunities").select("id", { count: "exact", head: true });
  countQuery = applyQuoteFiltersToQuery(countQuery, options?.filters, {
    includeWon: options?.includeWon,
  });
  const countResult = await countQuery;

  let query = supabase
    .from("opportunities")
    .select(QUOTE_SELECT)
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 200);

  query = applyQuoteFiltersToQuery(query, options?.filters, {
    includeWon: options?.includeWon,
  });

  const result = await query;

  if (result.error) {
    // Retry without line-item / order_status columns if migration not applied
    if (
      result.error.message?.includes("quantity") ||
      result.error.message?.includes("order_status") ||
      result.error.code === "42703"
    ) {
      return listQuotesLegacy(options);
    }
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) => mapQuoteRow(row as unknown as QuoteRow));

  return {
    data: items,
    count: countResult.count ?? items.length,
    error: null,
  };
}

async function listQuotesLegacy(options?: {
  filters?: QuoteFilters;
  limit?: number;
  includeWon?: boolean;
}): Promise<{ data: QuoteListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();
  const legacySelect =
    "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,valid_until,sent_at,accepted_at,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(product_id,products(id,name))";

  let countQuery = supabase.from("opportunities").select("id", { count: "exact", head: true });
  countQuery = applyQuoteFiltersToQuery(countQuery, options?.filters, {
    includeWon: options?.includeWon,
  });
  const countResult = await countQuery;

  let query = supabase
    .from("opportunities")
    .select(legacySelect)
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 200);
  query = applyQuoteFiltersToQuery(query, options?.filters, {
    includeWon: options?.includeWon,
  });

  const result = await query;
  if (result.error) {
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) =>
    mapQuoteRow({ ...(row as unknown as QuoteRow), next_action: null })
  );
  return { data: items, count: countResult.count ?? items.length, error: null };
}

export async function getQuoteById(id: string): Promise<QuoteListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(QUOTE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.message?.includes("quantity") || error.code === "42703") {
      const legacy = await supabase
        .from("opportunities")
        .select(
          "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,valid_until,sent_at,accepted_at,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(product_id,products(id,name))"
        )
        .eq("id", id)
        .maybeSingle();
      if (legacy.error || !legacy.data) return null;
      return mapQuoteRow({ ...(legacy.data as unknown as QuoteRow), next_action: null });
    }
    return null;
  }

  if (!data) return null;
  return mapQuoteRow(data as unknown as QuoteRow);
}

async function resolveQuoteUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function saveQuote(
  input: SaveQuoteInput
): Promise<{ quoteId: string | null; error: string | null }> {
  const userId = await resolveQuoteUserId();
  if (!userId) {
    return { quoteId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  let number = input.number?.trim() || null;
  if (!number) {
    const generated = await nextDocumentNumber("quote");
    if (generated.error) {
      return { quoteId: null, error: generated.error };
    }
    number = generated.number;
  }

  const linesTotal =
    input.lines && input.lines.length > 0
      ? calcDocumentTotal(input.lines)
      : input.totalAmount ?? 0;

  const productNames: string[] = [];
  const productIds =
    input.lines?.map((line) => line.productId) ?? input.productIds ?? [];
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id,name")
      .in("id", productIds);
    for (const product of products ?? []) {
      productNames.push(product.name);
    }
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      company_id: input.companyId,
      contact_id: input.contactId ?? null,
      user_id: userId,
      number,
      title: input.title.trim(),
      product_interest:
        productNames.length > 0 ? productNames.join(", ") : PRODUCT_FAMILY_LABELS[input.productFamily],
      product_family: input.productFamily,
      total_amount: linesTotal,
      probability: 50,
      stage: input.opportunityId ? "quote_sent" : "new",
      status: "draft",
      opened_at: now,
      valid_until: input.validUntil ?? null,
      notes: input.notes?.trim() || null,
      next_action: input.nextAction?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { quoteId: null, error: describeDbError(error) };
  }

  const { error: productsError, total } = await replaceOpportunityLines(
    data.id,
    input.lines,
    input.productIds
  );
  if (productsError) {
    // Rollback orphan header so we never leave a quote without its lines.
    await supabase.from("opportunities").delete().eq("id", data.id);
    return { quoteId: null, error: productsError };
  }

  if (total > 0 && total !== linesTotal) {
    await supabase.from("opportunities").update({ total_amount: total }).eq("id", data.id);
  }

  await logOpportunityChange({
    opportunityId: data.id,
    eventType: "created",
    notes: `Preventivo creato${number ? ` (${number})` : ""}`,
  });

  await saveContactHistoryActivity({
    companyId: input.companyId,
    type: "quote",
    title: `Preventivo: ${input.title.trim()}`,
    description: `Preventivo creato${number ? ` n. ${number}` : ""} per ${linesTotal.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}.`,
    occurredAt: now,
    source: "manual",
  });

  return { quoteId: data.id, error: null };
}

export async function updateQuote(
  quoteId: string,
  input: UpdateQuoteInput
): Promise<{ error: string | null }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    return { error: "Preventivo non trovato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const linesTotal =
    input.lines && input.lines.length > 0
      ? calcDocumentTotal(input.lines)
      : input.totalAmount ?? quote.total_amount;

  const productIds =
    input.lines?.map((line) => line.productId) ?? input.productIds ?? [];
  const productNames: string[] = [];
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id,name")
      .in("id", productIds);
    for (const product of products ?? []) {
      productNames.push(product.name);
    }
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      contact_id: input.contactId ?? null,
      number: input.number?.trim() || quote.number,
      title: input.title.trim(),
      product_interest:
        productNames.length > 0 ? productNames.join(", ") : PRODUCT_FAMILY_LABELS[input.productFamily],
      product_family: input.productFamily,
      total_amount: linesTotal,
      valid_until: input.validUntil ?? null,
      notes: input.notes?.trim() || null,
      next_action: input.nextAction?.trim() || null,
      updated_at: now,
      ...(input.status ? { status: input.status } : {}),
    })
    .eq("id", quoteId);

  if (error) {
    return { error: describeDbError(error) };
  }

  const { error: productsError, total } = await replaceOpportunityLines(
    quoteId,
    input.lines,
    input.productIds
  );
  if (productsError) {
    return { error: productsError };
  }

  if (total > 0) {
    await supabase.from("opportunities").update({ total_amount: total }).eq("id", quoteId);
  }

  if (input.status && input.status !== quote.status) {
    await logOpportunityChange({
      opportunityId: quoteId,
      eventType: "status_changed",
      fieldName: "status",
      oldValue: quote.status,
      newValue: input.status,
    });
  } else {
    await logOpportunityChange({
      opportunityId: quoteId,
      eventType: "updated",
      notes: "Preventivo aggiornato",
    });
  }

  await saveContactHistoryActivity({
    companyId: quote.company_id,
    type: "quote",
    title: `Preventivo aggiornato: ${input.title.trim()}`,
    description: `Preventivo modificato${input.number?.trim() ? ` n. ${input.number.trim()}` : quote.number ? ` n. ${quote.number}` : ""} — ${linesTotal.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}.`,
    occurredAt: now,
    source: "manual",
  });

  return { error: null };
}

export async function updateQuoteStatus(
  quoteId: string,
  status: OpportunityStatus
): Promise<{ success: boolean; message: string; orderId?: string }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    return { success: false, message: "Preventivo non trovato." };
  }

  if (quote.status === status) {
    return { success: true, message: `Preventivo già in stato ${status}.` };
  }

  if (status === "accepted") {
    const { orderId, error } = await convertQuoteToOrder(quoteId);
    if (error || !orderId) {
      return { success: false, message: error ?? "Conversione in ordine non riuscita." };
    }
    return {
      success: true,
      message: "Preventivo accettato e convertito in ordine.",
      orderId,
    };
  }

  const now = new Date().toISOString();
  const supabase = await createServerClient();

  const stage =
    status === "rejected" || status === "cancelled" || status === "expired"
      ? "lost"
      : status === "sent"
        ? "quote_sent"
        : quote.stage;

  const { error } = await supabase
    .from("opportunities")
    .update({
      status,
      stage,
      updated_at: now,
      ...(status === "sent" ? { sent_at: quote.sent_at ?? now } : {}),
    })
    .eq("id", quoteId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  await logOpportunityChange({
    opportunityId: quoteId,
    eventType: "status_changed",
    fieldName: "status",
    oldValue: quote.status,
    newValue: status,
  });

  return { success: true, message: "Stato preventivo aggiornato." };
}

export async function sendQuote(quoteId: string): Promise<{ success: boolean; message: string }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    return { success: false, message: "Preventivo non trovato." };
  }

  if (quote.status === "sent") {
    return { success: true, message: "Preventivo già marcato come inviato." };
  }

  const now = new Date().toISOString();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("opportunities")
    .update({
      status: "sent",
      stage: "quote_sent",
      sent_at: now,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  await saveContactHistoryActivity({
    companyId: quote.company_id,
    type: "quote",
    title: `Preventivo: ${quote.title}`,
    description: `Preventivo inviato${quote.number ? ` n. ${quote.number}` : ""} per ${quote.total_amount.toLocaleString("it-IT", { style: "currency", currency: quote.currency })}.`,
    occurredAt: now,
    source: "manual",
  });

  await logOpportunityChange({
    opportunityId: quoteId,
    eventType: "status_changed",
    fieldName: "status",
    oldValue: quote.status,
    newValue: "sent",
    notes: "Marcato come inviato",
  });

  return { success: true, message: "Preventivo marcato come inviato." };
}

export async function duplicateQuote(
  quoteId: string
): Promise<{ quoteId: string | null; error: string | null }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    return { quoteId: null, error: "Preventivo non trovato." };
  }

  return saveQuote({
    companyId: quote.company_id,
    contactId: quote.contact_id,
    title: `${quote.title} (copia)`,
    productFamily: quote.product_family,
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      vatRate: line.vatRate,
      description: line.description,
    })),
    totalAmount: quote.total_amount,
    validUntil: quote.valid_until,
    notes: quote.notes,
    nextAction: quote.next_action,
  });
}

export async function convertQuoteToOrder(
  quoteId: string
): Promise<{ orderId: string | null; error: string | null }> {
  const quote = await getQuoteById(quoteId);
  if (!quote) {
    return { orderId: null, error: "Preventivo non trovato." };
  }

  // Legacy in-place conversions already carry fulfillment fields on the same row.
  if (quote.stage === "won" && quote.order_status) {
    return { orderId: quote.id, error: null };
  }

  const supabase = await createServerClient();
  const { data: existingOrder } = await supabase
    .from("opportunities")
    .select("id")
    .eq("converted_from_id", quoteId)
    .eq("stage", "won")
    .not("order_status", "is", null)
    .maybeSingle();

  if (existingOrder?.id) {
    return { orderId: existingOrder.id, error: null };
  }

  const now = new Date().toISOString();
  const { orderId, error } = await saveOrder({
    companyId: quote.company_id,
    contactId: quote.contact_id,
    title: quote.title,
    productFamily: quote.product_family,
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      vatRate: line.vatRate,
      description: line.description,
      sortOrder: line.sortOrder,
    })),
    totalAmount: quote.total_amount,
    orderStatus: "confermato",
    orderDate: now.slice(0, 10),
    acceptedAt: now,
    convertedFromId: quoteId,
    notes: quote.notes,
    nextAction: quote.next_action,
  });

  if (error || !orderId) {
    return { orderId: null, error: error ?? "Creazione ordine non riuscita." };
  }

  // Keep the quote as accepted history (PRV number, no order_status) — separate from the new ORD row.
  const { error: quoteUpdateError } = await supabase
    .from("opportunities")
    .update({
      stage: "won",
      status: "accepted",
      probability: 100,
      accepted_at: quote.accepted_at ?? now,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (quoteUpdateError) {
    return { orderId: null, error: describeDbError(quoteUpdateError) };
  }

  await logOpportunityChange({
    opportunityId: quoteId,
    eventType: "converted_to_order",
    fieldName: "stage",
    oldValue: quote.stage,
    newValue: "won",
    notes: `Convertito in ordine ${orderId}`,
  });

  return { orderId, error: null };
}

export interface QuotesDashboardMetrics {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  openValue: number;
  sentValue: number;
  acceptedValue: number;
}

export async function getQuotesDashboardMetrics(): Promise<{
  data: QuotesDashboardMetrics;
  error: string | null;
}> {
  // Accepted quotes are stage=won; must include them or acceptance KPIs stay at 0.
  const { data, error } = await listQuotes({ limit: 1000, includeWon: true });
  if (error) {
    return {
      data: {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        openValue: 0,
        sentValue: 0,
        acceptedValue: 0,
      },
      error,
    };
  }

  const sentItems = data.filter((item) => item.status === "sent");
  const acceptedItems = data.filter((item) => item.status === "accepted");
  const openItems = data.filter(
    (item) => item.status === "draft" || item.status === "sent"
  );

  return {
    data: {
      total: data.length,
      draft: data.filter((item) => item.status === "draft").length,
      sent: sentItems.length,
      accepted: acceptedItems.length,
      openValue: openItems.reduce((sum, item) => sum + item.total_amount, 0),
      sentValue: sentItems.reduce((sum, item) => sum + item.total_amount, 0),
      acceptedValue: acceptedItems.reduce((sum, item) => sum + item.total_amount, 0),
    },
    error: null,
  };
}

export { listPipelineFilterOptions as listQuoteFilterOptions, listOpportunityChangeHistory };
