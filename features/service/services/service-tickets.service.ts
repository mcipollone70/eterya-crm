import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import { listPipelineFilterOptions } from "@/features/opportunities/services/opportunities.service";
import {
  getServiceTicketCategoryLabel,
  SERVICE_TICKET_PRIORITY_LABELS,
  SERVICE_TICKET_STATUS_LABELS,
  type ServiceTicketFilters,
} from "@/lib/constants/service-tickets";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { ActivityPriority, ServiceTicketStatus } from "@/lib/supabase/types";

export interface ServiceTicketListItem {
  id: string;
  company_id: string;
  company_name: string | null;
  product_id: string | null;
  product_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  order_id: string | null;
  user_id: string;
  number: string | null;
  title: string;
  description: string | null;
  category: string;
  status: ServiceTicketStatus;
  priority: ActivityPriority;
  opened_at: string;
  scheduled_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveServiceTicketInput {
  companyId: string;
  productId?: string | null;
  contactId?: string | null;
  orderId?: string | null;
  number?: string | null;
  title: string;
  description?: string | null;
  category?: string;
  status?: ServiceTicketStatus;
  priority?: ActivityPriority;
  scheduledAt?: string | null;
  resolution?: string | null;
}

export type UpdateServiceTicketInput = SaveServiceTicketInput;

const TICKET_SELECT =
  "id,company_id,product_id,contact_id,order_id,user_id,number,title,description,category,status,priority,opened_at,scheduled_at,resolved_at,closed_at,resolution,created_at,updated_at,companies(name),products(name),contacts(full_name)";

type TicketRow = {
  id: string;
  company_id: string;
  product_id: string | null;
  contact_id: string | null;
  order_id?: string | null;
  user_id: string;
  number: string | null;
  title: string;
  description: string | null;
  category: string;
  status: ServiceTicketStatus;
  priority: ActivityPriority;
  opened_at: string;
  scheduled_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  companies: { name: string } | { name: string }[] | null;
  products: { name: string } | { name: string }[] | null;
  contacts: { full_name: string } | { full_name: string }[] | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapTicketRow(row: TicketRow): ServiceTicketListItem {
  const company = relationOne(row.companies);
  const product = relationOne(row.products);
  const contact = relationOne(row.contacts);

  return {
    id: row.id,
    company_id: row.company_id,
    company_name: company?.name ?? null,
    product_id: row.product_id,
    product_name: product?.name ?? null,
    contact_id: row.contact_id,
    contact_name: contact?.full_name ?? null,
    order_id: row.order_id ?? null,
    user_id: row.user_id,
    number: row.number,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    priority: row.priority,
    opened_at: row.opened_at,
    scheduled_at: row.scheduled_at,
    resolved_at: row.resolved_at,
    closed_at: row.closed_at,
    resolution: row.resolution,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function applyTicketFilters<T extends {
  eq: (column: string, value: string) => T;
}>(query: T, filters?: ServiceTicketFilters): T {
  if (filters?.companyId) {
    query = query.eq("company_id", filters.companyId);
  }
  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }
  if (filters?.agentId) {
    query = query.eq("user_id", filters.agentId);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority) {
    query = query.eq("priority", filters.priority);
  }
  return query;
}

function isMissingTicketsTable(message: string | undefined): boolean {
  return Boolean(
    message && /service_tickets|service_ticket_status|relation .* does not exist/i.test(message)
  );
}

const MISSING_TABLE_MESSAGE =
  "Tabella assistenza non trovata. Esegui la migrazione 20260715_service_tickets.sql su Supabase.";

export async function listServiceTickets(options?: {
  filters?: ServiceTicketFilters;
  limit?: number;
}): Promise<{ data: ServiceTicketListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let countQuery = supabase.from("service_tickets").select("id", { count: "exact", head: true });
  countQuery = applyTicketFilters(countQuery, options?.filters);
  const countResult = await countQuery;

  let query = supabase
    .from("service_tickets")
    .select(TICKET_SELECT)
    .order("opened_at", { ascending: false })
    .limit(options?.limit ?? 200);

  query = applyTicketFilters(query, options?.filters);

  const result = await query;

  if (result.error) {
    if (isMissingTicketsTable(result.error.message)) {
      return { data: [], count: 0, error: MISSING_TABLE_MESSAGE };
    }
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) => mapTicketRow(row as unknown as TicketRow));

  return {
    data: items,
    count: countResult.count ?? items.length,
    error: null,
  };
}

export async function getServiceTicketById(id: string): Promise<ServiceTicketListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("service_tickets")
    .select(TICKET_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapTicketRow(data as unknown as TicketRow);
}

async function resolveTicketUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

function statusTimestamps(status: ServiceTicketStatus, previous?: ServiceTicketListItem | null): {
  resolved_at: string | null;
  closed_at: string | null;
} {
  const now = new Date().toISOString();
  if (status === "risolto") {
    return { resolved_at: previous?.resolved_at ?? now, closed_at: null };
  }
  if (status === "chiuso") {
    return {
      resolved_at: previous?.resolved_at ?? now,
      closed_at: previous?.closed_at ?? now,
    };
  }
  return { resolved_at: null, closed_at: null };
}

export async function saveServiceTicket(
  input: SaveServiceTicketInput
): Promise<{ ticketId: string | null; error: string | null }> {
  const userId = await resolveTicketUserId();
  if (!userId) {
    return { ticketId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const status = input.status ?? "aperto";
  const timestamps = statusTimestamps(status);

  const { data, error } = await supabase
    .from("service_tickets")
    .insert({
      company_id: input.companyId,
      product_id: input.productId ?? null,
      contact_id: input.contactId ?? null,
      order_id: input.orderId ?? null,
      user_id: userId,
      number: input.number?.trim() || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category ?? "assistenza",
      status,
      priority: input.priority ?? "medium",
      scheduled_at: input.scheduledAt ?? null,
      resolved_at: timestamps.resolved_at,
      closed_at: timestamps.closed_at,
      resolution: input.resolution?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingTicketsTable(error.message)) {
      return { ticketId: null, error: MISSING_TABLE_MESSAGE };
    }
    // Fallback without order_id if migration not applied
    if (error.message?.includes("order_id") || error.code === "42703") {
      const fallback = await supabase
        .from("service_tickets")
        .insert({
          company_id: input.companyId,
          product_id: input.productId ?? null,
          contact_id: input.contactId ?? null,
          user_id: userId,
          number: input.number?.trim() || null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          category: input.category ?? "assistenza",
          status,
          priority: input.priority ?? "medium",
          scheduled_at: input.scheduledAt ?? null,
          resolved_at: timestamps.resolved_at,
          closed_at: timestamps.closed_at,
          resolution: input.resolution?.trim() || null,
        })
        .select("id")
        .single();
      if (fallback.error) {
        return { ticketId: null, error: describeDbError(fallback.error) };
      }
      await saveContactHistoryActivity({
        companyId: input.companyId,
        type: "note",
        title: `Assistenza: ${input.title.trim()}`,
        description: `Ticket ${getServiceTicketCategoryLabel(input.category ?? "assistenza")} aperto. Stato: ${SERVICE_TICKET_STATUS_LABELS[status]}.`,
        source: "manual",
      });
      return { ticketId: fallback.data.id, error: null };
    }
    return { ticketId: null, error: describeDbError(error) };
  }

  await saveContactHistoryActivity({
    companyId: input.companyId,
    type: "note",
    title: `Assistenza: ${input.title.trim()}`,
    description: `Ticket ${getServiceTicketCategoryLabel(input.category ?? "assistenza")} aperto. Stato: ${SERVICE_TICKET_STATUS_LABELS[status]}.`,
    source: "manual",
  });

  return { ticketId: data.id, error: null };
}

export async function updateServiceTicket(
  ticketId: string,
  input: UpdateServiceTicketInput
): Promise<{ error: string | null }> {
  const ticket = await getServiceTicketById(ticketId);
  if (!ticket) {
    return { error: "Ticket non trovato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const status = input.status ?? ticket.status;
  const timestamps = statusTimestamps(status, ticket);

  const { error } = await supabase
    .from("service_tickets")
    .update({
      company_id: input.companyId,
      product_id: input.productId ?? null,
      contact_id: input.contactId ?? null,
      order_id: input.orderId ?? ticket.order_id ?? null,
      number: input.number?.trim() || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category ?? ticket.category,
      status,
      priority: input.priority ?? ticket.priority,
      scheduled_at: input.scheduledAt ?? null,
      resolved_at: timestamps.resolved_at,
      closed_at: timestamps.closed_at,
      resolution: input.resolution?.trim() || null,
      updated_at: now,
    })
    .eq("id", ticketId);

  if (error) {
    return { error: describeDbError(error) };
  }

  if (status !== ticket.status || input.title.trim() !== ticket.title) {
    await saveContactHistoryActivity({
      companyId: input.companyId,
      type: "note",
      title: `Assistenza aggiornata: ${input.title.trim()}`,
      description: `Stato: ${SERVICE_TICKET_STATUS_LABELS[status]} · priorità ${SERVICE_TICKET_PRIORITY_LABELS[input.priority ?? ticket.priority]}.`,
      occurredAt: now,
      source: "manual",
    });
  }

  return { error: null };
}

export async function deleteServiceTicket(ticketId: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("service_tickets").delete().eq("id", ticketId);
  return { error: describeDbError(error) };
}

export async function getServiceTicketsDashboardMetrics(): Promise<{
  data: { total: number; open: number; resolved: number };
  error: string | null;
}> {
  const { data, error } = await listServiceTickets({ limit: 1000 });
  if (error) {
    return { data: { total: 0, open: 0, resolved: 0 }, error };
  }

  return {
    data: {
      total: data.length,
      open: data.filter((item) => item.status !== "chiuso" && item.status !== "risolto").length,
      resolved: data.filter((item) => item.status === "risolto" || item.status === "chiuso").length,
    },
    error: null,
  };
}

export { listPipelineFilterOptions as listServiceTicketFilterOptions };
