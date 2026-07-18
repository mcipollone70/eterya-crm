import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import {
  listPipelineFilterOptions,
  type OpportunityListItem,
} from "@/features/opportunities/services/opportunities.service";
import { CLOSED_WON_STAGE } from "@/lib/constants/opportunity-pipeline";
import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import {
  isOrderFulfillmentStatus,
  type OrderFilters,
} from "@/lib/constants/orders";
import type { CommercialLineItem } from "@/lib/constants/commercial-lines";
import { calcDocumentTotal } from "@/lib/constants/commercial-lines";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { OrderFulfillmentStatus } from "@/lib/supabase/types";
import {
  logOpportunityChange,
  mapOpportunityProductRows,
  nextDocumentNumber,
  replaceOpportunityLines,
} from "@/features/quotes/services/commercial-document.service";
import type { SaveOrderInput, UpdateOrderInput } from "../types";

export type { SaveOrderInput, UpdateOrderInput };

export interface OrderListItem extends OpportunityListItem {
  number: string | null;
  accepted_at: string | null;
  order_status: OrderFulfillmentStatus | null;
  expected_delivery_at: string | null;
  order_date: string | null;
  lines: CommercialLineItem[];
  converted_from_id: string | null;
  next_action: string | null;
}

const ORDER_SELECT =
  "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,accepted_at,order_status,expected_delivery_at,order_date,converted_from_id,next_action,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(id,product_id,quantity,unit_price,discount_percent,vat_rate,line_total,description,sort_order,products(id,name,unit_price))";

type OrderRow = {
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
  status: string;
  opened_at?: string | null;
  expected_close_at?: string | null;
  accepted_at?: string | null;
  order_status?: string | null;
  expected_delivery_at?: string | null;
  order_date?: string | null;
  converted_from_id?: string | null;
  next_action?: string | null;
  notes: string | null;
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

function mapOrderRow(row: OrderRow): OrderListItem {
  const company = relationOne(row.companies);
  const contact = relationOne(row.contacts);
  const lines = mapOpportunityProductRows(row.opportunity_products);
  const productIds = lines.map((line) => line.productId);
  const productNames = lines.map((line) => line.productName).filter(Boolean) as string[];

  const productFamily =
    row.product_family && isProductFamily(row.product_family)
      ? row.product_family
      : ("zanzariere" as ProductFamily);

  const orderStatus =
    row.order_status && isOrderFulfillmentStatus(row.order_status)
      ? row.order_status
      : ("confermato" as OrderFulfillmentStatus);

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
    stage: CLOSED_WON_STAGE,
    status: "accepted",
    opened_at: row.opened_at ?? row.created_at,
    expected_close_at: row.expected_close_at ?? null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    number: row.number ?? null,
    accepted_at: row.accepted_at ?? null,
    order_status: orderStatus,
    expected_delivery_at: row.expected_delivery_at ?? null,
    order_date: row.order_date ?? null,
    lines,
    converted_from_id: row.converted_from_id ?? null,
    next_action: row.next_action ?? null,
  };
}

function applyOrderFiltersToQuery<T extends {
  eq: (column: string, value: string) => T;
  not: (column: string, operator: string, value: null) => T;
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
}>(query: T, filters?: OrderFilters): T {
  query = query.eq("stage", CLOSED_WON_STAGE);
  // Accepted quotes kept as stage=won without fulfillment fields must not appear as orders.
  query = query.not("order_status", "is", null);
  if (filters?.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters?.status) {
    query = query.eq("order_status", filters.status);
  }
  if (filters?.from) {
    query = query.gte("accepted_at", filters.from);
  }
  if (filters?.to) {
    query = query.lte("accepted_at", `${filters.to}T23:59:59.999Z`);
  }
  return query;
}

export async function listOrders(options?: {
  filters?: OrderFilters;
  limit?: number;
}): Promise<{ data: OrderListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let countQuery = supabase.from("opportunities").select("id", { count: "exact", head: true });
  countQuery = applyOrderFiltersToQuery(countQuery, options?.filters);
  const countResult = await countQuery;

  let query = supabase
    .from("opportunities")
    .select(ORDER_SELECT)
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 200);

  query = applyOrderFiltersToQuery(query, options?.filters);

  const result = await query;

  if (result.error) {
    if (result.error.message?.includes("order_status") || result.error.code === "42703") {
      return listOrdersLegacy(options);
    }
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow));

  return {
    data: items,
    count: countResult.count ?? items.length,
    error: null,
  };
}

async function listOrdersLegacy(options?: {
  filters?: OrderFilters;
  limit?: number;
}): Promise<{ data: OrderListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();
  const legacySelect =
    "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,accepted_at,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(product_id,products(id,name))";

  let countQuery = supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("stage", CLOSED_WON_STAGE);
  if (options?.filters?.agentId) countQuery = countQuery.eq("user_id", options.filters.agentId);
  if (options?.filters?.companyId) {
    countQuery = countQuery.eq("company_id", options.filters.companyId);
  }
  const countResult = await countQuery;

  let query = supabase
    .from("opportunities")
    .select(legacySelect)
    .eq("stage", CLOSED_WON_STAGE)
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .limit(options?.limit ?? 200);
  if (options?.filters?.agentId) query = query.eq("user_id", options.filters.agentId);
  if (options?.filters?.companyId) {
    query = query.eq("company_id", options.filters.companyId);
  }

  const result = await query;
  if (result.error) {
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) =>
    mapOrderRow({
      ...(row as unknown as OrderRow),
      order_status: "confermato",
      expected_delivery_at: null,
      order_date: null,
      converted_from_id: null,
      next_action: null,
    })
  );

  return { data: items, count: countResult.count ?? items.length, error: null };
}

export async function getOrderById(id: string): Promise<OrderListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(ORDER_SELECT)
    .eq("id", id)
    .eq("stage", CLOSED_WON_STAGE)
    .not("order_status", "is", null)
    .maybeSingle();

  if (error) {
    if (error.message?.includes("order_status") || error.code === "42703") {
      const { data: legacy } = await supabase
        .from("opportunities")
        .select(
          "id,company_id,contact_id,user_id,number,title,product_interest,product_family,total_amount,currency,probability,stage,status,opened_at,expected_close_at,accepted_at,notes,created_at,updated_at,companies(name),contacts(full_name),opportunity_products(product_id,products(id,name))"
        )
        .eq("id", id)
        .eq("stage", CLOSED_WON_STAGE)
        .maybeSingle();
      if (!legacy) return null;
      return mapOrderRow({
        ...(legacy as unknown as OrderRow),
        order_status: "confermato",
        expected_delivery_at: null,
        order_date: null,
        converted_from_id: null,
        next_action: null,
      });
    }
    return null;
  }

  if (!data) return null;
  return mapOrderRow(data as unknown as OrderRow);
}

async function resolveOrderUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

async function logOrderActivity(order: {
  company_id: string;
  title: string;
  number: string | null;
  total_amount: number;
  currency: string;
  accepted_at: string | null;
}): Promise<void> {
  await saveContactHistoryActivity({
    companyId: order.company_id,
    type: "note",
    title: `Ordine: ${order.title}`,
    description: `Ordine registrato${order.number ? ` n. ${order.number}` : ""} per ${order.total_amount.toLocaleString("it-IT", { style: "currency", currency: order.currency })}.`,
    outcome: "ordine",
    occurredAt: order.accepted_at ?? new Date().toISOString(),
    source: "manual",
  });
}

export async function saveOrder(
  input: SaveOrderInput
): Promise<{ orderId: string | null; error: string | null }> {
  const userId = await resolveOrderUserId();
  if (!userId) {
    return { orderId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const acceptedAt = input.acceptedAt ?? new Date().toISOString();
  const orderDate = input.orderDate ?? acceptedAt.slice(0, 10);

  let number = input.number?.trim() || null;
  if (!number) {
    const generated = await nextDocumentNumber("order");
    if (generated.error) {
      return { orderId: null, error: generated.error };
    }
    number = generated.number;
  }

  const linesTotal =
    input.lines && input.lines.length > 0
      ? calcDocumentTotal(input.lines)
      : input.totalAmount ?? 0;

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
      probability: 100,
      stage: CLOSED_WON_STAGE,
      status: "accepted",
      opened_at: acceptedAt,
      accepted_at: acceptedAt,
      order_status: input.orderStatus ?? "confermato",
      order_date: orderDate,
      expected_delivery_at: input.expectedDeliveryAt ?? null,
      next_action: input.nextAction?.trim() || null,
      converted_from_id: input.convertedFromId ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id,company_id,title,number,total_amount,currency,accepted_at")
    .single();

  if (error) {
    // Fallback without new columns
    if (error.message?.includes("order_status") || error.code === "42703") {
      const fallback = await supabase
        .from("opportunities")
        .insert({
          company_id: input.companyId,
          contact_id: input.contactId ?? null,
          user_id: userId,
          number,
          title: input.title.trim(),
          product_interest:
            productNames.length > 0
              ? productNames.join(", ")
              : PRODUCT_FAMILY_LABELS[input.productFamily],
          product_family: input.productFamily,
          total_amount: linesTotal,
          probability: 100,
          stage: CLOSED_WON_STAGE,
          status: "accepted",
          opened_at: acceptedAt,
          accepted_at: acceptedAt,
          notes: input.notes?.trim() || null,
        })
        .select("id,company_id,title,number,total_amount,currency,accepted_at")
        .single();

      if (fallback.error) {
        return { orderId: null, error: describeDbError(fallback.error) };
      }

      const { error: linesError, total } = await replaceOpportunityLines(
        fallback.data.id,
        input.lines,
        input.productIds
      );
      if (linesError) {
        await supabase.from("opportunities").delete().eq("id", fallback.data.id);
        return { orderId: null, error: linesError };
      }
      if (total > 0) {
        await supabase
          .from("opportunities")
          .update({ total_amount: total })
          .eq("id", fallback.data.id);
      }
      await logOrderActivity({
        company_id: fallback.data.company_id,
        title: fallback.data.title,
        number: fallback.data.number,
        total_amount: total > 0 ? total : Number(fallback.data.total_amount),
        currency: fallback.data.currency,
        accepted_at: fallback.data.accepted_at,
      });
      return { orderId: fallback.data.id, error: null };
    }
    return { orderId: null, error: describeDbError(error) };
  }

  const { error: productsError, total } = await replaceOpportunityLines(
    data.id,
    input.lines,
    input.productIds
  );
  if (productsError) {
    await supabase.from("opportunities").delete().eq("id", data.id);
    return { orderId: null, error: productsError };
  }

  if (total > 0) {
    await supabase.from("opportunities").update({ total_amount: total }).eq("id", data.id);
  }

  await logOrderActivity({
    company_id: data.company_id,
    title: data.title,
    number: data.number,
    total_amount: Number(data.total_amount),
    currency: data.currency,
    accepted_at: data.accepted_at,
  });

  await logOpportunityChange({
    opportunityId: data.id,
    eventType: "created",
    notes: `Ordine creato${number ? ` (${number})` : ""}`,
  });

  return { orderId: data.id, error: null };
}

export async function updateOrder(
  orderId: string,
  input: UpdateOrderInput
): Promise<{ error: string | null }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { error: "Ordine non trovato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const linesTotal =
    input.lines && input.lines.length > 0
      ? calcDocumentTotal(input.lines)
      : input.totalAmount ?? order.total_amount;

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

  const acceptedAt = input.acceptedAt ?? order.accepted_at ?? now;

  const { error } = await supabase
    .from("opportunities")
    .update({
      contact_id: input.contactId ?? null,
      number: input.number?.trim() || order.number,
      title: input.title.trim(),
      product_interest:
        productNames.length > 0 ? productNames.join(", ") : PRODUCT_FAMILY_LABELS[input.productFamily],
      product_family: input.productFamily,
      total_amount: linesTotal,
      accepted_at: acceptedAt,
      order_status: input.orderStatus ?? order.order_status,
      order_date: input.orderDate ?? order.order_date,
      expected_delivery_at: input.expectedDeliveryAt ?? order.expected_delivery_at,
      next_action: input.nextAction?.trim() || null,
      notes: input.notes?.trim() || null,
      updated_at: now,
    })
    .eq("id", orderId);

  if (error) {
    return { error: describeDbError(error) };
  }

  const { error: productsError, total } = await replaceOpportunityLines(
    orderId,
    input.lines,
    input.productIds
  );
  if (productsError) {
    return { error: productsError };
  }

  if (total > 0) {
    await supabase.from("opportunities").update({ total_amount: total }).eq("id", orderId);
  }

  if (input.orderStatus && input.orderStatus !== order.order_status) {
    await logOpportunityChange({
      opportunityId: orderId,
      eventType: "status_changed",
      fieldName: "order_status",
      oldValue: order.order_status,
      newValue: input.orderStatus,
    });
  } else {
    await logOpportunityChange({
      opportunityId: orderId,
      eventType: "updated",
      notes: "Ordine aggiornato",
    });
  }

  await saveContactHistoryActivity({
    companyId: order.company_id,
    type: "note",
    title: `Ordine aggiornato: ${input.title.trim()}`,
    description: `Ordine modificato${input.number?.trim() ? ` n. ${input.number.trim()}` : order.number ? ` n. ${order.number}` : ""} — ${linesTotal.toLocaleString("it-IT", { style: "currency", currency: order.currency })}.`,
    outcome: "ordine",
    occurredAt: now,
    source: "manual",
  });

  return { error: null };
}

export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderFulfillmentStatus
): Promise<{ success: boolean; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, message: "Ordine non trovato." };
  }

  if (order.order_status === orderStatus) {
    return { success: true, message: "Stato evasione già aggiornato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("opportunities")
    .update({
      order_status: orderStatus,
      updated_at: now,
    })
    .eq("id", orderId);

  if (error) {
    if (error.message?.includes("order_status") || error.code === "42703") {
      return {
        success: false,
        message:
          "Stato evasione non disponibile. Esegui la migrazione commerciale 20260716 su Supabase.",
      };
    }
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  await logOpportunityChange({
    opportunityId: orderId,
    eventType: "status_changed",
    fieldName: "order_status",
    oldValue: order.order_status,
    newValue: orderStatus,
  });

  return { success: true, message: "Stato evasione aggiornato." };
}

export { listPipelineFilterOptions as listOrderFilterOptions };

export async function getOrderDashboardMetrics(): Promise<{
  data: {
    orderCount: number;
    totalValue: number;
    inProgress: number;
    delivered: number;
  };
  error: string | null;
}> {
  const { data, count, error } = await listOrders({ limit: 1000 });
  if (error) {
    return { data: { orderCount: 0, totalValue: 0, inProgress: 0, delivered: 0 }, error };
  }

  return {
    data: {
      orderCount: count,
      totalValue: data.reduce((sum, item) => sum + item.total_amount, 0),
      inProgress: data.filter(
        (item) =>
          item.order_status === "confermato" ||
          item.order_status === "in_lavorazione" ||
          item.order_status === "pronto"
      ).length,
      delivered: data.filter((item) => item.order_status === "consegnato").length,
    },
    error: null,
  };
}
