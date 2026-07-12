import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type {
  CompanyStatus,
  GeocodeStatus,
  Tables,
  UpdateTables,
} from "@/lib/supabase/types";
import type { CompanyInsert } from "../utils/build-db-rows";

export type Company = Tables<"companies">;
export type CompanyUpdate = UpdateTables<"companies">;

/** Colonne mostrate in elenco — sottoinsieme leggero della riga completa. */
export interface CompanyListItem {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  vat_number: string | null;
  phone: string | null;
  email: string | null;
  status: CompanyStatus;
  geocode_status: GeocodeStatus;
  created_at: string;
}

const LIST_COLUMNS =
  "id,name,city,province,vat_number,phone,email,status,geocode_status,created_at";

/**
 * Nota: l'accesso avviene con il client server auth-scoped (`@supabase/ssr`),
 * quindi le query girano come ruolo `authenticated` e sono soggette alle policy
 * RLS. I chiamanti verificano `isSupabaseConfigured()` per il degrado grazioso
 * quando l'ambiente pubblico non è presente.
 */

export async function listCompanies(
  limit = 100
): Promise<{ data: CompanyListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();
  const { data, count, error } = await supabase
    .from("companies")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (data ?? []) as CompanyListItem[],
    count: count ?? 0,
    error: describeDbError(error),
  };
}

export async function getCompanyById(
  id: string
): Promise<{ data: Company | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return { data: data ?? null, error: describeDbError(error) };
}

export async function insertCompany(
  row: CompanyInsert
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .insert(row)
    .select("id")
    .single();

  return { id: data?.id ?? null, error: describeDbError(error) };
}

export async function updateCompanyById(
  id: string,
  row: CompanyUpdate
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update(row).eq("id", id);
  return { error: describeDbError(error) };
}

export async function deleteCompanyById(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  return { error: describeDbError(error) };
}
