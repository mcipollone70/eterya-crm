import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Tables } from "@/lib/supabase/types";

export type Brand = Tables<"brands">;

export async function listBrands(options?: {
  activeOnly?: boolean;
}): Promise<{ data: Brand[]; error: string | null }> {
  const supabase = await createServerClient();
  let query = supabase
    .from("brands")
    .select(
      "id,name,slug,short_code,color,logo_url,is_active,created_at,updated_at"
    )
    .order("name", { ascending: true });

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return { data: (data ?? []) as Brand[], error: null };
}

export async function getBrandById(
  brandId: string
): Promise<{ data: Brand | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id,name,slug,short_code,color,logo_url,is_active,created_at,updated_at"
    )
    .eq("id", brandId)
    .maybeSingle();

  if (error) {
    return { data: null, error: describeDbError(error) };
  }

  return { data: (data as Brand | null) ?? null, error: null };
}

export async function getBrandBySlug(
  slug: string
): Promise<{ data: Brand | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id,name,slug,short_code,color,logo_url,is_active,created_at,updated_at"
    )
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    return { data: null, error: describeDbError(error) };
  }

  return { data: (data as Brand | null) ?? null, error: null };
}
