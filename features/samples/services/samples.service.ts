import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import { listPipelineFilterOptions } from "@/features/opportunities/services/opportunities.service";
import { SAMPLE_STATUS_LABELS, type SampleFilters } from "@/lib/constants/samples";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { SampleStatus } from "@/lib/supabase/types";

export interface SampleListItem {
  id: string;
  company_id: string;
  company_name: string | null;
  product_id: string | null;
  product_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  user_id: string;
  title: string;
  quantity: number;
  status: SampleStatus;
  given_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveSampleInput {
  companyId: string;
  productId?: string | null;
  contactId?: string | null;
  title: string;
  quantity?: number;
  status?: SampleStatus;
  givenAt?: string | null;
  expectedReturnAt?: string | null;
  notes?: string | null;
}

export type UpdateSampleInput = SaveSampleInput;

const SAMPLE_SELECT =
  "id,company_id,product_id,contact_id,user_id,title,quantity,status,given_at,expected_return_at,returned_at,notes,created_at,updated_at,companies(name),products(name),contacts(full_name)";

type SampleRow = {
  id: string;
  company_id: string;
  product_id: string | null;
  contact_id: string | null;
  user_id: string;
  title: string;
  quantity: number;
  status: SampleStatus;
  given_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  notes: string | null;
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

function mapSampleRow(row: SampleRow): SampleListItem {
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
    user_id: row.user_id,
    title: row.title,
    quantity: Number(row.quantity),
    status: row.status,
    given_at: row.given_at,
    expected_return_at: row.expected_return_at,
    returned_at: row.returned_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function applySampleFilters<T extends {
  eq: (column: string, value: string) => T;
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
}>(query: T, filters?: SampleFilters): T {
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
  if (filters?.from) {
    query = query.gte("given_at", filters.from);
  }
  if (filters?.to) {
    query = query.lte("given_at", `${filters.to}T23:59:59.999Z`);
  }
  return query;
}

function isMissingSamplesTable(message: string | undefined): boolean {
  return Boolean(message && /product_samples|sample_status|relation .* does not exist/i.test(message));
}

export async function listSamples(options?: {
  filters?: SampleFilters;
  limit?: number;
}): Promise<{ data: SampleListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let countQuery = supabase.from("product_samples").select("id", { count: "exact", head: true });
  countQuery = applySampleFilters(countQuery, options?.filters);
  const countResult = await countQuery;

  let query = supabase
    .from("product_samples")
    .select(SAMPLE_SELECT)
    .order("given_at", { ascending: false })
    .limit(options?.limit ?? 200);

  query = applySampleFilters(query, options?.filters);

  const result = await query;

  if (result.error) {
    if (isMissingSamplesTable(result.error.message)) {
      return {
        data: [],
        count: 0,
        error:
          "Tabella campioni non trovata. Esegui la migrazione 20260715_product_samples.sql su Supabase.",
      };
    }
    return { data: [], count: 0, error: describeDbError(result.error) };
  }

  const items = (result.data ?? []).map((row) => mapSampleRow(row as unknown as SampleRow));

  return {
    data: items,
    count: countResult.count ?? items.length,
    error: null,
  };
}

export async function getSampleById(id: string): Promise<SampleListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("product_samples")
    .select(SAMPLE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSampleRow(data as unknown as SampleRow);
}

async function resolveSampleUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function saveSample(
  input: SaveSampleInput
): Promise<{ sampleId: string | null; error: string | null }> {
  const userId = await resolveSampleUserId();
  if (!userId) {
    return { sampleId: null, error: "Utente non autenticato." };
  }

  const supabase = await createServerClient();
  const givenAt = input.givenAt ?? new Date().toISOString();
  const status = input.status ?? "consegnato";

  const { data, error } = await supabase
    .from("product_samples")
    .insert({
      company_id: input.companyId,
      product_id: input.productId ?? null,
      contact_id: input.contactId ?? null,
      user_id: userId,
      title: input.title.trim(),
      quantity: input.quantity ?? 1,
      status,
      given_at: givenAt,
      expected_return_at: input.expectedReturnAt ?? null,
      returned_at: status === "restituito" ? new Date().toISOString() : null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingSamplesTable(error.message)) {
      return {
        sampleId: null,
        error:
          "Tabella campioni non trovata. Esegui la migrazione 20260715_product_samples.sql su Supabase.",
      };
    }
    return { sampleId: null, error: describeDbError(error) };
  }

  await saveContactHistoryActivity({
    companyId: input.companyId,
    type: "note",
    title: `Campione: ${input.title.trim()}`,
    description: `Campione consegnato (${input.quantity ?? 1} pz). Stato: ${SAMPLE_STATUS_LABELS[status]}.`,
    occurredAt: givenAt,
    source: "manual",
  });

  return { sampleId: data.id, error: null };
}

export async function updateSample(
  sampleId: string,
  input: UpdateSampleInput
): Promise<{ error: string | null }> {
  const sample = await getSampleById(sampleId);
  if (!sample) {
    return { error: "Campione non trovato." };
  }

  const supabase = await createServerClient();
  const now = new Date().toISOString();
  const status = input.status ?? sample.status;

  const returnedAt =
    status === "restituito"
      ? sample.returned_at ?? now
      : status === "consegnato"
        ? null
        : sample.returned_at;

  const { error } = await supabase
    .from("product_samples")
    .update({
      company_id: input.companyId,
      product_id: input.productId ?? null,
      contact_id: input.contactId ?? null,
      title: input.title.trim(),
      quantity: input.quantity ?? 1,
      status,
      given_at: input.givenAt ?? sample.given_at,
      expected_return_at: input.expectedReturnAt ?? null,
      returned_at: returnedAt,
      notes: input.notes?.trim() || null,
      updated_at: now,
    })
    .eq("id", sampleId);

  if (error) {
    return { error: describeDbError(error) };
  }

  if (status !== sample.status || input.title.trim() !== sample.title) {
    await saveContactHistoryActivity({
      companyId: input.companyId,
      type: "note",
      title: `Campione aggiornato: ${input.title.trim()}`,
      description: `Stato: ${SAMPLE_STATUS_LABELS[status]} · quantità ${input.quantity ?? sample.quantity}.`,
      occurredAt: now,
      source: "manual",
    });
  }

  return { error: null };
}

export async function deleteSample(sampleId: string): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("product_samples").delete().eq("id", sampleId);
  return { error: describeDbError(error) };
}

export async function getSamplesDashboardMetrics(): Promise<{
  data: { total: number; outstanding: number; purchased: number };
  error: string | null;
}> {
  const { data, error } = await listSamples({ limit: 1000 });
  if (error) {
    return { data: { total: 0, outstanding: 0, purchased: 0 }, error };
  }

  return {
    data: {
      total: data.length,
      outstanding: data.filter((item) => item.status === "consegnato").length,
      purchased: data.filter((item) => item.status === "acquistato").length,
    },
    error: null,
  };
}

export { listPipelineFilterOptions as listSampleFilterOptions };
