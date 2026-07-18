/**
 * Repair: collega ETERYA da Anagrafica Eterya.xlsx alle aziende CRM senza link.
 * Non modifica importer né schema.
 *
 * Run: DRY_RUN=0 node scripts/repair-eterya-excel-links.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import xlsx from "xlsx";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\s*s?\b/g, " srl ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKeys(value) {
  const full = normalizeName(value);
  const keys = new Set();
  if (full) keys.add(full);
  const noCode = full.replace(/\s+\d{3,}$/g, "").trim();
  if (noCode) keys.add(noCode);
  const stripped = noCode
    .replace(/\b(srl|srls|spa|snc|sas|ss|soc|cooperativa)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped) keys.add(stripped);
  return [...keys];
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const DRY_RUN = process.env.DRY_RUN !== "0";

const { error: authErr } = await sb.auth.signInWithPassword({
  email: process.env.PROBE_EMAIL || "eterya.tester3@gmail.com",
  password: process.env.PROBE_PASSWORD || "TestPassword123!",
});
if (authErr) {
  console.error("AUTH", authErr.message);
  process.exit(1);
}
console.log(DRY_RUN ? "MODE=DRY_RUN (set DRY_RUN=0 to write)" : "MODE=WRITE");

const { data: eterya } = await sb
  .from("brands")
  .select("id,slug")
  .eq("slug", "eterya")
  .maybeSingle();
if (!eterya) {
  console.error("ETERYA brand missing");
  process.exit(1);
}

const path = "C:/Users/Marco/Desktop/Anagrafica Eterya.xlsx";
const wb = xlsx.readFile(path);
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
const nameHeaders = [
  "Ragione sociale",
  "Ragione Sociale",
  "Cliente",
  "Nome",
  "Azienda",
];
const excelNames = [];
for (const row of rows) {
  const keys = Object.keys(row);
  let name = "";
  for (const header of nameHeaders) {
    const key = keys.find((k) => k.trim().toLowerCase() === header.toLowerCase());
    if (key && String(row[key]).trim()) {
      name = String(row[key]).trim();
      break;
    }
  }
  if (name) excelNames.push(name);
}

const companies = [];
let from = 0;
while (true) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name")
    .order("id")
    .range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  companies.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}

const byNorm = new Map();
for (const c of companies) {
  for (const key of nameKeys(c.name)) {
    if (!byNorm.has(key)) byNorm.set(key, []);
    const list = byNorm.get(key);
    if (!list.some((x) => x.id === c.id)) list.push(c);
  }
}

let linked = 0;
let already = 0;
let unmatched = 0;
const samples = [];

const unique = new Map();
for (const name of excelNames) unique.set(normalizeName(name), name);

for (const [norm, original] of unique) {
  let matches = byNorm.get(norm) ?? [];
  if (!matches.length) {
    const seen = new Set();
    matches = [];
    for (const key of nameKeys(original)) {
      for (const company of byNorm.get(key) ?? []) {
        if (!seen.has(company.id)) {
          seen.add(company.id);
          matches.push(company);
        }
      }
    }
  }
  if (!matches.length) {
    unmatched++;
    continue;
  }
  for (const company of matches) {
    const { data: existing } = await sb
      .from("company_brands")
      .select("brand_id")
      .eq("company_id", company.id);
    const have = new Set((existing ?? []).map((r) => r.brand_id));
    if (have.has(eterya.id)) {
      already++;
      continue;
    }
    const isPrimary = have.size === 0;
    if (!DRY_RUN) {
      const { error } = await sb.from("company_brands").insert({
        company_id: company.id,
        brand_id: eterya.id,
        is_primary: isPrimary,
      });
      if (error) {
        console.error("insert fail", company.name, error.message);
        continue;
      }
    }
    linked++;
    samples.push({ company: company.name, id: company.id, excel: original, isPrimary });
  }
}

console.log({ linked, already, unmatched, samples });
