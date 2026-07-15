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

/**
 * Chiavi payload Excel che indicano un referente persona (case-insensitive sul nome chiave).
 * Esclude esplicitamente "NOME CAPO GRUPPO" (ragione sociale capogruppo / banca, non persona).
 */
const REFERENT_PAYLOAD_KEY_KEYWORDS = [
  "referente",
  "contatto",
  "contact",
  "nome referente",
  "persona di contatto",
] as const;

const EXCLUDED_REFERENT_PAYLOAD_KEY_PATTERNS = [
  /capo\s*gruppo/i,
  /fatturato/i,
  /ragione\s*sociale/i,
  /denominazione/i,
  /\bbanca\b/i,
  /\bpec\b/i,
  /partita\s*iva/i,
  /codice\s*fiscale/i,
  /carica\s*esponente/i,
] as const;

const COMPANY_NAME_VALUE_PATTERNS = [
  /\bs\.?\s*p\.?\s*a\.?\b/i,
  /\bs\.?\s*r\.?\s*l\.?\b/i,
  /\bs\.?\s*a\.?\s*s\.?\b/i,
  /\bbanca\b/i,
  /\bsociet[aà]/i,
  /\bgruppo\b/i,
  /\bholding\b/i,
  /\binc\.?\b/i,
  /\bltd\.?\b/i,
  /\bgmbh\b/i,
] as const;

const COMPANY_REFERENT_FETCH_OR = [
  "contact_name.not.is.null",
  "import_payload->>Esponente 1.neq.",
  "import_payload->>Esponente 2.neq.",
  "import_payload->>Esponente 3.neq.",
  "import_payload->>Esponente 4.neq.",
  "import_payload->>Esponente 5.neq.",
].join(",");

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

function normalizePayloadKey(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedReferentPayloadKey(key: string): boolean {
  const normalized = normalizePayloadKey(key);
  return EXCLUDED_REFERENT_PAYLOAD_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isReferentPayloadKey(key: string): boolean {
  if (isExcludedReferentPayloadKey(key)) return false;

  const normalized = normalizePayloadKey(key);
  if (/^esponente\s*\d+$/.test(normalized)) return true;

  return REFERENT_PAYLOAD_KEY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function referentPayloadKeyPriority(key: string): number {
  const normalized = normalizePayloadKey(key);
  const esponenteMatch = normalized.match(/^esponente\s*(\d+)$/);
  if (esponenteMatch) return Number(esponenteMatch[1]);

  if (normalized.includes("referente") || normalized.includes("contatto") || normalized.includes("contact")) {
    return 0;
  }

  return 50;
}

function looksLikeCompanyOrBankName(value: string, companyName: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.localeCompare(companyName.trim(), "it", { sensitivity: "accent" }) === 0) {
    return true;
  }
  return COMPANY_NAME_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function payloadReferentCandidates(
  payload: Record<string, unknown>
): Array<{ key: string; value: string; priority: number }> {
  const candidates: Array<{ key: string; value: string; priority: number }> = [];

  for (const [key, raw] of Object.entries(payload)) {
    if (!isReferentPayloadKey(key)) continue;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    candidates.push({ key, value, priority: referentPayloadKeyPriority(key) });
  }

  return candidates.sort((a, b) => a.priority - b.priority);
}

function resolveCompanyReferentName(row: CompanyReferentSource): string | null {
  const structured = row.contact_name?.trim();
  if (structured && !looksLikeCompanyOrBankName(structured, row.name)) {
    return structured;
  }

  const payload = row.import_payload;
  if (!payload || typeof payload !== "object") return null;

  for (const { value } of payloadReferentCandidates(payload)) {
    if (!looksLikeCompanyOrBankName(value, row.name)) {
      return value;
    }
  }

  return null;
}

function companyReferentToListItem(
  row: CompanyReferentSource,
  fullName: string
): ContactListItem {
  return {
    id: row.id,
    full_name: fullName,
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
      .or(COMPANY_REFERENT_FETCH_OR)
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
    .filter((row) => !companyIdsWithContactRow.has(row.id))
    .map((row) => ({ row, fullName: resolveCompanyReferentName(row) }))
    .filter((entry): entry is { row: CompanyReferentSource; fullName: string } => entry.fullName !== null)
    .map(({ row, fullName }) => companyReferentToListItem(row, fullName));

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
