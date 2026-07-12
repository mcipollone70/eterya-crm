import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { SelectOption } from "@/lib/forms";
import type { InsertTables, Tables, UpdateTables } from "@/lib/supabase/types";

export type Contact = Tables<"contacts">;
export type ContactInsert = InsertTables<"contacts">;
export type ContactUpdate = UpdateTables<"contacts">;

/** Riga di elenco contatto arricchita col nome azienda (embed a-uno). */
export interface ContactListItem {
  id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  company_id: string;
  company: { name: string } | null;
}

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

/**
 * L'accesso avviene con il client server auth-scoped (`@supabase/ssr`): le query
 * girano come ruolo `authenticated` e sono soggette alle policy RLS. I chiamanti
 * verificano `isSupabaseConfigured()` per il degrado grazioso lato UI.
 */

export async function listContacts(
  limit = 200
): Promise<{ data: ContactListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();
  const { data, count, error } = await supabase
    .from("contacts")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("full_name", { ascending: true })
    .limit(limit);

  return {
    data: (data ?? []) as unknown as ContactListItem[],
    count: count ?? 0,
    error: describeDbError(error),
  };
}

export async function listContactsByCompany(
  companyId: string
): Promise<{ data: ContactListItem[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(LIST_COLUMNS)
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("full_name", { ascending: true });

  return {
    data: (data ?? []) as unknown as ContactListItem[],
    error: describeDbError(error),
  };
}

export async function getContactById(
  id: string
): Promise<{ data: (Contact & { company: { name: string } | null }) | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*,company:companies(name)")
    .eq("id", id)
    .maybeSingle();

  return {
    data: (data as unknown as (Contact & { company: { name: string } | null }) | null) ?? null,
    error: describeDbError(error),
  };
}

/** Opzioni azienda per la select del form contatto (elenco limitato per l'MVP). */
export async function listCompanyOptions(
  limit = 500
): Promise<{ options: SelectOption[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(limit);

  return {
    options: (data ?? []).map((row) => ({ value: row.id, label: row.name })),
    error: describeDbError(error),
  };
}

export async function insertContact(
  row: ContactInsert
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert(row)
    .select("id")
    .single();

  return { id: data?.id ?? null, error: describeDbError(error) };
}

export async function updateContactById(
  id: string,
  row: ContactUpdate
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("contacts").update(row).eq("id", id);
  return { error: describeDbError(error) };
}

export async function deleteContactById(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  return { error: describeDbError(error) };
}
