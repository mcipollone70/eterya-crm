import "server-only";

import {
  isProductFamily,
  PRODUCT_FAMILY_LABELS,
  type ProductFamily,
} from "@/lib/constants/product-catalog";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Tables } from "@/lib/supabase/types";

export type Product = Tables<"products">;

export interface ProductListItem {
  id: string;
  name: string;
  family: ProductFamily;
  description: string | null;
  is_active: boolean;
  price_range_min: number | null;
  price_range_max: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveProductInput {
  name: string;
  family: ProductFamily;
  description?: string | null;
  isActive?: boolean;
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  notes?: string | null;
}

export interface ProductFamilyDashboardMetrics {
  family: ProductFamily;
  label: string;
  interestedCompanies: number;
  openOpportunities: number;
  pipelineValue: number;
}

const PRODUCT_SELECT =
  "id,name,family,description,is_active,price_range_min,price_range_max,notes,created_at,updated_at";

function mapProductRow(row: {
  id: string;
  name: string;
  family: string;
  description: string | null;
  is_active: boolean;
  price_range_min: number | null;
  price_range_max: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}): ProductListItem | null {
  if (!isProductFamily(row.family)) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    family: row.family,
    description: row.description,
    is_active: row.is_active,
    price_range_min: row.price_range_min != null ? Number(row.price_range_min) : null,
    price_range_max: row.price_range_max != null ? Number(row.price_range_max) : null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listProducts(options?: {
  activeOnly?: boolean;
  family?: ProductFamily;
  active?: boolean;
  query?: string;
}): Promise<{ data: ProductListItem[]; error: string | null }> {
  const supabase = await createServerClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("family", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly || options?.active === true) {
    query = query.eq("is_active", true);
  } else if (options?.active === false) {
    query = query.eq("is_active", false);
  }

  if (options?.family) {
    query = query.eq("family", options.family);
  }

  if (options?.query) {
    query = query.ilike("name", `%${options.query}%`);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const items = (data ?? [])
    .map((row) => mapProductRow(row))
    .filter((item): item is ProductListItem => item !== null);

  return { data: items, error: null };
}

export async function getProductById(id: string): Promise<ProductListItem | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapProductRow(data);
}

export async function saveProduct(
  input: SaveProductInput
): Promise<{ productId: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      family: input.family,
      description: input.description?.trim() || null,
      is_active: input.isActive ?? true,
      price_range_min: input.priceRangeMin ?? null,
      price_range_max: input.priceRangeMax ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { productId: null, error: describeDbError(error) };
  }

  return { productId: data.id, error: null };
}

export async function updateProduct(
  productId: string,
  input: SaveProductInput
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      family: input.family,
      description: input.description?.trim() || null,
      is_active: input.isActive ?? true,
      price_range_min: input.priceRangeMin ?? null,
      price_range_max: input.priceRangeMax ?? null,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  return { error: describeDbError(error) };
}

export async function getProductCatalogSummary(): Promise<{
  data: { total: number; active: number; byFamily: Record<string, number> };
  error: string | null;
}> {
  const { data, error } = await listProducts();
  if (error) {
    return { data: { total: 0, active: 0, byFamily: {} }, error };
  }

  const byFamily: Record<string, number> = {};
  let active = 0;
  for (const product of data) {
    byFamily[product.family] = (byFamily[product.family] ?? 0) + 1;
    if (product.is_active) {
      active += 1;
    }
  }

  return {
    data: { total: data.length, active, byFamily },
    error: null,
  };
}

export async function getProductDashboardMetrics(): Promise<{
  data: ProductFamilyDashboardMetrics[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const [interestsRes, opportunitiesRes] = await Promise.all([
    supabase
      .from("company_product_interests")
      .select("company_id,relation_type,products(family)")
      .eq("relation_type", "interest"),
    supabase
      .from("opportunities")
      .select("product_family,total_amount,stage")
      .not("stage", "in", '("won","lost")'),
  ]);

  if (interestsRes.error) {
    return { data: [], error: describeDbError(interestsRes.error) };
  }

  if (opportunitiesRes.error) {
    return { data: [], error: describeDbError(opportunitiesRes.error) };
  }

  const companiesByFamily = new Map<ProductFamily, Set<string>>();
  for (const rawRow of interestsRes.data ?? []) {
    const row = rawRow as {
      company_id: string | null;
      products: { family: string } | { family: string }[] | null;
    };
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || !isProductFamily(product.family) || !row.company_id) {
      continue;
    }
    const set = companiesByFamily.get(product.family) ?? new Set<string>();
    set.add(row.company_id);
    companiesByFamily.set(product.family, set);
  }

  const opportunitiesByFamily = new Map<ProductFamily, { count: number; value: number }>();
  for (const row of opportunitiesRes.data ?? []) {
    if (!isProductFamily(row.product_family)) {
      continue;
    }
    const current = opportunitiesByFamily.get(row.product_family) ?? { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(row.total_amount ?? 0);
    opportunitiesByFamily.set(row.product_family, current);
  }

  const families = Object.keys(PRODUCT_FAMILY_LABELS) as ProductFamily[];
  const data = families.map((family) => ({
    family,
    label: PRODUCT_FAMILY_LABELS[family],
    interestedCompanies: companiesByFamily.get(family)?.size ?? 0,
    openOpportunities: opportunitiesByFamily.get(family)?.count ?? 0,
    pipelineValue: opportunitiesByFamily.get(family)?.value ?? 0,
  }));

  return { data, error: null };
}
