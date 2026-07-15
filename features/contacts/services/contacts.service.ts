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
  /** Referente ancora solo sull'anagrafica azienda (import Excel), senza riga in `contacts`. */
  fromCompanyReferent?: boolean;
}

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

/** Colonna referente tipica nei file Excel importati (non mappata su `contact_name` in import). */
const IMPORT_REFERENT_PAYLOAD_KEY = "NOME CAPO GRUPPO";

const COMPANY_REFERENT_COLUMNS =
  "id,name,contact_name,contact_email,contact_phone,contact_role,import_payload";

interface CompanyReferentSource {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  import_payload: Record<string, unknown> | null;
}

function resolveCompanyReferentName(row: CompanyReferentSource): string | null {
  const structured = row.contact_name?.trim();
  if (structured) return structured;

  const payload = row.import_payload;
  if (!payload || typeof payload !== "object") return null;

  const fromPayload = payload[IMPORT_REFERENT_PAYLOAD_KEY];
  const name = typeof fromPayload === "string" ? fromPayload.trim() : "";
  return name.length > 0 ? name : null;
}

function companyReferentToListItem(row: CompanyReferentSource): ContactListItem {
  return {
    id: row.id,
    full_name: resolveCompanyReferentName(row) ?? row.name,
    role: row.contact_role,
    email: row.contact_email,
    phone: row.contact_phone,
    mobile: null,
    is_primary: true,
    company_id: row.id,
    company: { name: row.name },
    fromCompanyReferent: true,
  };
}

/**
 * L'accesso avviene con il client server auth-scoped (`@supabase/ssr`): le query
 * girano come ruolo `authenticated` e sono soggette alle policy RLS. I chiamanti
 * verificano `isSupabaseConfigured()` per il degrado grazioso lato UI.
 */

export async function listContacts(
  limit = 200
): Promise<{ data: ContactListItem[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  const [contactsResult, referentsResult] = await Promise.all([
    supabase
      .from("contacts")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("full_name", { ascending: true }),
    supabase
      .from("companies")
      .select(COMPANY_REFERENT_COLUMNS)
      .or(
        `contact_name.not.is.null,import_payload->>${IMPORT_REFERENT_PAYLOAD_KEY}.neq.`
      )
      .order("name", { ascending: true }),
  ]);

  const contactsError = describeDbError(contactsResult.error);
  const referentsError = describeDbError(referentsResult.error);
  if (contactsError) {
    return { data: [], count: 0, error: contactsError };
  }
  if (referentsError) {
    return { data: [], count: 0, error: referentsError };
  }

  const tableContacts = (contactsResult.data ?? []) as unknown as ContactListItem[];
  const companyIdsWithContactRow = new Set(
    tableContacts.map((contact) => contact.company_id)
  );

  const companyReferents = (referentsResult.data ?? [])
    .map((row) => row as unknown as CompanyReferentSource)
    .filter(
      (row) =>
        !companyIdsWithContactRow.has(row.id) && resolveCompanyReferentName(row) !== null
    )
    .map(companyReferentToListItem);

  const merged = [...tableContacts, ...companyReferents].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "it", { sensitivity: "base" })
  );

  return {
    data: merged.slice(0, limit),
    count: tableContacts.length + companyReferents.length,
    error: null,
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
  limit = 500,
  includeCompanyId?: string | null
): Promise<{ options: SelectOption[]; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(limit);

  let options = (data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const companyId = includeCompanyId?.trim();
  if (companyId && !options.some((option) => option.value === companyId)) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      return { options, error: describeDbError(companyError) };
    }

    if (company) {
      options = [{ value: company.id, label: company.name }, ...options];
    }
  }

  return {
    options,
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

/** Un solo referente principale per azienda: azzera gli altri prima di impostarne uno. */
export async function unsetOtherPrimaryContacts(
  companyId: string,
  excludeContactId?: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  let query = supabase
    .from("contacts")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (excludeContactId) {
    query = query.neq("id", excludeContactId);
  }

  const { error } = await query;
  return { error: describeDbError(error) };
}

/** Rimuove i riferimenti al contatto da opportunità, follow-up e promemoria agenda. */
export async function clearContactCrossReferences(
  contactId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();

  const [opportunities, followUps, reminders] = await Promise.all([
    supabase.from("opportunities").update({ contact_id: null }).eq("contact_id", contactId),
    supabase.from("follow_ups").update({ contact_id: null }).eq("contact_id", contactId),
    supabase.from("agenda_reminders").update({ contact_id: null }).eq("contact_id", contactId),
  ]);

  const error = opportunities.error ?? followUps.error ?? reminders.error;
  return { error: describeDbError(error) };
}
