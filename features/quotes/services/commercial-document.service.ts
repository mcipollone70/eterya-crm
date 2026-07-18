import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  calcLineTotal,
  normalizeLineInputs,
  type CommercialLineInput,
  type CommercialLineItem,
} from "@/lib/constants/commercial-lines";

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    /does not exist|Could not find the (function|table|column)/i.test(message)
  );
}

export async function nextDocumentNumber(
  docType: "quote" | "order"
): Promise<{ number: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("next_commercial_document_number", {
    p_doc_type: docType,
  });

  if (error) {
    // Only degrade if the RPC/table is truly missing; never mask permission/runtime errors.
    if (isMissingSchemaError(error)) {
      const year = new Date().getFullYear();
      const prefix = docType === "quote" ? "PRV" : "ORD";
      const stamp = Date.now().toString().slice(-6);
      return { number: `${prefix}-${year}-${stamp}`, error: null };
    }
    return { number: null, error: describeDbError(error) };
  }

  return { number: typeof data === "string" ? data : null, error: null };
}

export async function logOpportunityChange(input: {
  opportunityId: string;
  eventType: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
}): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createServerClient();
  await supabase.from("opportunity_change_history").insert({
    opportunity_id: input.opportunityId,
    event_type: input.eventType,
    field_name: input.fieldName ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    notes: input.notes ?? null,
    changed_by: user?.id ?? null,
  });
}

export async function listOpportunityChangeHistory(
  opportunityId: string
): Promise<{ data: Array<{
  id: string;
  event_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  changed_at: string;
}>; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("opportunity_change_history")
    .select("id,event_type,field_name,old_value,new_value,notes,changed_at")
    .eq("opportunity_id", opportunityId)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return { data: data ?? [], error: null };
}

export async function replaceOpportunityLines(
  opportunityId: string,
  lines: CommercialLineInput[] | undefined,
  fallbackProductIds?: string[]
): Promise<{ lines: CommercialLineItem[]; total: number; error: string | null }> {
  const normalized = normalizeLineInputs(lines, fallbackProductIds);
  const supabase = await createServerClient();

  const { error: deleteError } = await supabase
    .from("opportunity_products")
    .delete()
    .eq("opportunity_id", opportunityId);

  if (deleteError) {
    return { lines: [], total: 0, error: describeDbError(deleteError) };
  }

  if (normalized.length === 0) {
    return { lines: [], total: 0, error: null };
  }

  const rows = normalized.map((line, index) => ({
    opportunity_id: opportunityId,
    product_id: line.productId,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    discount_percent: line.discountPercent ?? 0,
    vat_rate: line.vatRate ?? 22,
    line_total: calcLineTotal(line),
    description: line.description ?? null,
    sort_order: line.sortOrder ?? index,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("opportunity_products")
    .insert(rows)
    .select(
      "id,product_id,quantity,unit_price,discount_percent,vat_rate,line_total,description,sort_order"
    );

  if (insertError) {
    // Only fallback if line-item columns are missing; never silently drop prices.
    if (isMissingSchemaError(insertError)) {
      const simple = normalized.map((line) => ({
        opportunity_id: opportunityId,
        product_id: line.productId,
      }));
      const { error: simpleError } = await supabase.from("opportunity_products").insert(simple);
      if (simpleError) {
        return { lines: [], total: 0, error: describeDbError(simpleError) };
      }
      return {
        lines: normalized.map((line) => ({ ...line, lineTotal: calcLineTotal(line) })),
        total: normalized.reduce((sum, line) => sum + calcLineTotal(line), 0),
        error: null,
      };
    }
    return { lines: [], total: 0, error: describeDbError(insertError) };
  }

  const mapped = mapOpportunityProductRows(inserted);

  return {
    lines: mapped,
    total: mapped.reduce((sum, line) => sum + line.lineTotal, 0),
    error: null,
  };
}

export function mapOpportunityProductRows(
  rows:
    | Array<{
        id?: string | null;
        product_id: string;
        quantity?: number | null;
        unit_price?: number | null;
        discount_percent?: number | null;
        vat_rate?: number | null;
        line_total?: number | null;
        description?: string | null;
        sort_order?: number | null;
        products?: { id: string; name: string; unit_price?: number | null } | { id: string; name: string; unit_price?: number | null }[] | null;
      }>
    | null
    | undefined
): CommercialLineItem[] {
  if (!rows) return [];

  return rows
    .map((row, index) => {
      const product = Array.isArray(row.products) ? row.products[0] ?? null : row.products ?? null;
      const quantity = Number(row.quantity ?? 1) || 1;
      const unitPrice = Number(row.unit_price ?? product?.unit_price ?? 0) || 0;
      const discountPercent = Number(row.discount_percent ?? 0) || 0;
      const vatRate = Number(row.vat_rate ?? 22) || 22;
      const lineTotal =
        row.line_total != null
          ? Number(row.line_total)
          : calcLineTotal({ quantity, unitPrice, discountPercent, vatRate });

      return {
        id: row.id ?? undefined,
        productId: row.product_id,
        productName: product?.name ?? null,
        quantity,
        unitPrice,
        discountPercent,
        vatRate,
        description: row.description ?? null,
        sortOrder: row.sort_order ?? index,
        lineTotal,
      };
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
