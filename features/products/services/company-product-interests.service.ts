import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import {
  isInterestLevel,
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
  INTEREST_LEVEL_LABELS,
  type InterestLevel,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CompanyProductRelation, ProductInterestLevel } from "@/lib/supabase/types";

export interface CompanyProductInterestItem {
  id: string;
  company_id: string;
  product_id: string;
  product_name: string;
  product_family: ProductFamily;
  relation_type: CompanyProductRelation;
  interest_level: ProductInterestLevel | null;
  last_interest_at: string | null;
  commercial_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCompanyInterestItem extends CompanyProductInterestItem {
  company_name: string | null;
}

export interface CompanyProductInterestHistoryItem {
  id: string;
  company_id: string;
  product_id: string;
  product_name: string;
  product_family: ProductFamily;
  relation_type: CompanyProductRelation;
  interest_level: ProductInterestLevel | null;
  event_type: string;
  notes: string | null;
  occurred_at: string;
}

export interface AddCompanyProductInput {
  companyId: string;
  productId: string;
  relationType: CompanyProductRelation;
  interestLevel?: InterestLevel | null;
  commercialNotes?: string | null;
}

const INTEREST_SELECT =
  "id,company_id,product_id,relation_type,interest_level,last_interest_at,commercial_notes,created_at,updated_at,products(name,family)";

const HISTORY_SELECT =
  "id,company_id,product_id,relation_type,interest_level,event_type,notes,occurred_at,products(name,family)";

type InterestRow = {
  id: string;
  company_id: string;
  product_id: string;
  relation_type: CompanyProductRelation;
  interest_level: ProductInterestLevel | null;
  last_interest_at: string | null;
  commercial_notes: string | null;
  created_at: string;
  updated_at: string;
  products: { name: string; family: string } | { name: string; family: string }[] | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapInterestRow(row: InterestRow): CompanyProductInterestItem | null {
  const product = relationOne(row.products);
  if (!product || !isProductFamily(product.family)) {
    return null;
  }

  return {
    id: row.id,
    company_id: row.company_id,
    product_id: row.product_id,
    product_name: product.name,
    product_family: product.family,
    relation_type: row.relation_type,
    interest_level: row.interest_level,
    last_interest_at: row.last_interest_at,
    commercial_notes: row.commercial_notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function appendInterestHistory(input: {
  companyId: string;
  productId: string;
  relationType: CompanyProductRelation;
  interestLevel: ProductInterestLevel | null;
  eventType: string;
  notes?: string | null;
  occurredAt?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createServerClient();

  await supabase.from("company_product_interest_history").insert({
    company_id: input.companyId,
    product_id: input.productId,
    relation_type: input.relationType,
    interest_level: input.interestLevel,
    event_type: input.eventType,
    notes: input.notes?.trim() || null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    created_by: user?.id ?? null,
  });
}

export async function listCompanyProductInterests(
  companyId: string
): Promise<{ data: CompanyProductInterestItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("company_product_interests")
    .select(INTEREST_SELECT)
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const items = (data ?? [])
    .map((row) => mapInterestRow(row as InterestRow))
    .filter((item): item is CompanyProductInterestItem => item !== null);

  return { data: items, error: null };
}

export async function listProductCompanyInterests(
  productId: string
): Promise<{ data: ProductCompanyInterestItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("company_product_interests")
    .select(
      "id,company_id,product_id,relation_type,interest_level,last_interest_at,commercial_notes,created_at,updated_at,products(name,family),companies(name)"
    )
    .eq("product_id", productId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const items: ProductCompanyInterestItem[] = [];
  for (const raw of data ?? []) {
    const mapped = mapInterestRow(raw as InterestRow);
    if (!mapped) continue;
    const companies = (raw as { companies?: { name: string } | { name: string }[] | null })
      .companies;
    const company = relationOne(companies);
    items.push({
      ...mapped,
      company_name: company?.name ?? null,
    });
  }

  return { data: items, error: null };
}

export async function listCompanyProductInterestHistory(
  companyId: string,
  limit = 50
): Promise<{ data: CompanyProductInterestHistoryItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("company_product_interest_history")
    .select(HISTORY_SELECT)
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const items: CompanyProductInterestHistoryItem[] = [];
  for (const rawRow of data ?? []) {
    const row = rawRow as {
      id: string;
      company_id: string;
      product_id: string;
      relation_type: CompanyProductRelation;
      interest_level: ProductInterestLevel | null;
      event_type: string;
      notes: string | null;
      occurred_at: string;
      products: InterestRow["products"];
    };
    const product = relationOne(row.products);
    if (!product || !isProductFamily(product.family)) {
      continue;
    }

    items.push({
      id: row.id,
      company_id: row.company_id,
      product_id: row.product_id,
      product_name: product.name,
      product_family: product.family,
      relation_type: row.relation_type,
      interest_level: row.interest_level,
      event_type: row.event_type,
      notes: row.notes,
      occurred_at: row.occurred_at,
    });
  }

  return { data: items, error: null };
}

export async function addCompanyProductInterest(
  input: AddCompanyProductInput
): Promise<{ success: boolean; message: string }> {
  const now = new Date().toISOString();
  const supabase = await createServerClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,name,family")
    .eq("id", input.productId)
    .maybeSingle();

  if (productError || !product) {
    return { success: false, message: "Prodotto non trovato." };
  }

  const interestLevel =
    input.relationType === "interest" && input.interestLevel
      ? input.interestLevel
      : input.relationType === "interest"
        ? "medium"
        : null;

  const { error } = await supabase.from("company_product_interests").upsert(
    {
      company_id: input.companyId,
      product_id: input.productId,
      relation_type: input.relationType,
      interest_level: interestLevel,
      last_interest_at: input.relationType === "interest" ? now : null,
      commercial_notes: input.commercialNotes?.trim() || null,
      updated_at: now,
    },
    { onConflict: "company_id,product_id,relation_type" }
  );

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  const familyLabel = isProductFamily(product.family)
    ? PRODUCT_FAMILY_LABELS[product.family]
    : product.family;
  const levelLabel =
    interestLevel && isInterestLevel(interestLevel)
      ? INTEREST_LEVEL_LABELS[interestLevel]
      : null;

  await appendInterestHistory({
    companyId: input.companyId,
    productId: input.productId,
    relationType: input.relationType,
    interestLevel,
    eventType: input.relationType === "purchased" ? "purchased" : "added",
    notes:
      input.relationType === "purchased"
        ? `Prodotto acquistato: ${product.name} (${familyLabel})`
        : `Interesse ${levelLabel ?? "Medio"} per ${product.name} (${familyLabel})${
            input.commercialNotes?.trim() ? `. ${input.commercialNotes.trim()}` : ""
          }`,
    occurredAt: now,
  });

  return {
    success: true,
    message:
      input.relationType === "purchased"
        ? "Prodotto registrato come acquistato."
        : "Prodotto di interesse aggiunto.",
  };
}

export async function removeCompanyProductInterest(
  interestId: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient();

  const { data: existing, error: loadError } = await supabase
    .from("company_product_interests")
    .select("id,company_id,product_id,relation_type,interest_level,products(name,family)")
    .eq("id", interestId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (loadError || !existing) {
    return { success: false, message: "Interesse prodotto non trovato." };
  }

  const { error } = await supabase
    .from("company_product_interests")
    .delete()
    .eq("id", interestId)
    .eq("company_id", companyId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Errore database." };
  }

  const product = relationOne(
    existing.products as { name: string; family: string } | { name: string; family: string }[] | null
  );
  const productName = product?.name ?? "Prodotto";
  const familyLabel =
    product && isProductFamily(product.family)
      ? PRODUCT_FAMILY_LABELS[product.family]
      : product?.family ?? "";

  await appendInterestHistory({
    companyId,
    productId: existing.product_id,
    relationType: existing.relation_type,
    interestLevel: existing.interest_level,
    eventType: "removed",
    notes: `Rimosso ${existing.relation_type === "purchased" ? "acquisto" : "interesse"}: ${productName}${familyLabel ? ` (${familyLabel})` : ""}`,
    occurredAt: new Date().toISOString(),
  });

  return { success: true, message: "Prodotto rimosso dall'azienda." };
}

export async function resolveCompanyIdsForProductFilters(options: {
  productFamily?: ProductFamily | null;
  interestLevel?: InterestLevel | null;
  purchasedProductId?: string | null;
}): Promise<{ companyIds: string[] | null; error: string | null }> {
  if (!options.productFamily && !options.interestLevel && !options.purchasedProductId) {
    return { companyIds: null, error: null };
  }

  const supabase = await createServerClient();
  let companyIds: Set<string> | null = null;

  if (options.productFamily) {
    const { data, error } = await supabase
      .from("company_product_interests")
      .select("company_id,products!inner(family)")
      .eq("relation_type", "interest")
      .eq("products.family", options.productFamily);

    if (error) {
      return { companyIds: [], error: describeDbError(error) };
    }

    companyIds = new Set(
      (data ?? [])
        .map((row) => (row as { company_id: string | null }).company_id)
        .filter((id): id is string => Boolean(id))
    );
  }

  if (options.interestLevel) {
    const { data, error } = await supabase
      .from("company_product_interests")
      .select("company_id")
      .eq("relation_type", "interest")
      .eq("interest_level", options.interestLevel);

    if (error) {
      return { companyIds: [], error: describeDbError(error) };
    }

    const levelIds = new Set(
      (data ?? [])
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id))
    );

    companyIds = companyIds ? new Set([...companyIds].filter((id) => levelIds.has(id))) : levelIds;
  }

  if (options.purchasedProductId) {
    const { data, error } = await supabase
      .from("company_product_interests")
      .select("company_id")
      .eq("relation_type", "purchased")
      .eq("product_id", options.purchasedProductId);

    if (error) {
      return { companyIds: [], error: describeDbError(error) };
    }

    const purchasedIds = new Set(
      (data ?? [])
        .map((row) => row.company_id as string | null)
        .filter((id): id is string => Boolean(id))
    );

    companyIds = companyIds
      ? new Set([...companyIds].filter((id) => purchasedIds.has(id)))
      : purchasedIds;
  }

  return { companyIds: companyIds ? [...companyIds] : [], error: null };
}
