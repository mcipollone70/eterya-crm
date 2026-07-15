import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

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
];

const REFERENT_PAYLOAD_KEY_KEYWORDS = [
  "referente",
  "contatto",
  "contact",
  "nome referente",
  "persona di contatto",
];

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
];

const COMPANY_REFERENT_FETCH_OR = [
  "contact_name.not.is.null",
  "import_payload->>Esponente 1.neq.",
  "import_payload->>Esponente 2.neq.",
  "import_payload->>Esponente 3.neq.",
  "import_payload->>Esponente 4.neq.",
  "import_payload->>Esponente 5.neq.",
].join(",");

function normalizePayloadKey(key) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedReferentPayloadKey(key) {
  const normalized = normalizePayloadKey(key);
  return EXCLUDED_REFERENT_PAYLOAD_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isReferentPayloadKey(key) {
  if (isExcludedReferentPayloadKey(key)) return false;
  const normalized = normalizePayloadKey(key);
  if (/^esponente\s*\d+$/.test(normalized)) return true;
  return REFERENT_PAYLOAD_KEY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function looksLikeCompanyOrBankName(value, companyName) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.localeCompare(companyName.trim(), "it", { sensitivity: "accent" }) === 0) {
    return true;
  }
  return COMPANY_NAME_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function resolveCompanyReferentName(row) {
  const structured = row.contact_name?.trim();
  if (structured && !looksLikeCompanyOrBankName(structured, row.name)) {
    return structured;
  }
  const payload = row.import_payload;
  if (!payload || typeof payload !== "object") return null;
  const candidates = [];
  for (const [key, raw] of Object.entries(payload)) {
    if (!isReferentPayloadKey(key)) continue;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) continue;
    candidates.push({ key, value });
  }
  for (const { value } of candidates) {
    if (!looksLikeCompanyOrBankName(value, row.name)) return value;
  }
  return null;
}

async function fetchAllCompanies(authed) {
  const batchSize = 1000;
  let offset = 0;
  const rows = [];
  while (true) {
    const { data, error } = await authed
      .from("companies")
      .select("id,name,contact_name,import_payload")
      .or(COMPANY_REFERENT_FETCH_OR)
      .order("name", { ascending: true })
      .range(offset, offset + batchSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < batchSize) break;
    offset += batchSize;
  }
  return rows;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const email = `probe-pagination-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signUp.session.access_token}` } },
});

const contactsCount = await authed.from("contacts").select("id", { count: "exact", head: true });
const companiesTotal = await authed.from("companies").select("id", { count: "exact", head: true });
const referentFilterCount = await authed
  .from("companies")
  .select("id", { count: "exact", head: true })
  .or(COMPANY_REFERENT_FETCH_OR);

const singleFetch = await authed
  .from("companies")
  .select("id,name,contact_name,import_payload")
  .or(COMPANY_REFERENT_FETCH_OR)
  .order("name", { ascending: true });

const { data: tableContacts } = await authed
  .from("contacts")
  .select("id,full_name,company_id")
  .order("full_name", { ascending: true });

const companyIdsWithContactRow = new Set((tableContacts ?? []).map((c) => c.company_id));
const allReferentCompanies = await fetchAllCompanies(authed);

const validReferents = allReferentCompanies
  .filter((row) => !companyIdsWithContactRow.has(row.id))
  .map((row) => ({ row, fullName: resolveCompanyReferentName(row) }))
  .filter((e) => e.fullName !== null);

const merged = [
  ...(tableContacts ?? []).map((c) => ({ full_name: c.full_name, company_id: c.company_id, manual: true })),
  ...validReferents.map((e) => ({
    full_name: e.fullName,
    company_id: e.row.id,
    company_name: e.row.name,
    manual: false,
  })),
].sort((a, b) => a.full_name.localeCompare(b.full_name, "it", { sensitivity: "base" }));

const sirmac = allReferentCompanies.filter((r) => /sirmac/i.test(r.name));
const belmonteIdx = merged.findIndex((c) => /belmonte/i.test(c.full_name) && /giancarlo/i.test(c.full_name));
const belmonte = merged.filter((c) => /belmonte/i.test(c.full_name));

console.log(
  JSON.stringify(
    {
      contactsTableCount: contactsCount.count,
      companiesTotal: companiesTotal.count,
      referentFilterCountExact: referentFilterCount.count,
      singleFetchRowsReturned: singleFetch.data?.length,
      batchedReferentCompanies: allReferentCompanies.length,
      validSyntheticReferents: validReferents.length,
      totalMergedContacts: merged.length,
      sirmacCompanies: sirmac.map((r) => ({
        name: r.name,
        contact_name: r.contact_name,
        resolved: resolveCompanyReferentName(r),
        hasManualContact: companyIdsWithContactRow.has(r.id),
      })),
      belmonteMatches: belmonte.map((c) => ({
        full_name: c.full_name,
        company_name: c.company_name,
        manual: c.manual,
        pageAt25: Math.floor(merged.findIndex((m) => m.full_name === c.full_name) / 25) + 1,
        index: merged.findIndex((m) => m.full_name === c.full_name) + 1,
      })),
      belmonteGiancarloIndex: belmonteIdx >= 0 ? belmonteIdx + 1 : null,
      belmonteGiancarloPage25: belmonteIdx >= 0 ? Math.floor(belmonteIdx / 25) + 1 : null,
    },
    null,
    2
  )
);
