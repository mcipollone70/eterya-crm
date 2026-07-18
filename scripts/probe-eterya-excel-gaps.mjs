/**
 * Match Anagrafica Eterya.xlsx names to CRM companies missing ETERYA brand.
 * Run: node scripts/probe-eterya-excel-gaps.mjs
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
    .replace(/\bs\s*\.?\s*p\s*\.?\s*a\s*\.?\b/g, " spa ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKeys(value) {
  const full = normalizeName(value);
  const keys = new Set();
  if (full) keys.add(full);
  const stripped = full
    .replace(/\s+\d{3,}$/g, "")
    .replace(/\b(srl|srls|spa|snc|sas|ss|soc|cooperativa)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped) keys.add(stripped);
  const noCode = full.replace(/\s+\d{3,}$/g, "").trim();
  if (noCode) keys.add(noCode);
  return [...keys];
}

function one(v) {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

const path = "C:/Users/Marco/Desktop/Anagrafica Eterya.xlsx";
const wb = xlsx.readFile(path);
console.log("sheets", wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
console.log("rows", rows.length, "headers", Object.keys(rows[0] ?? {}));

const nameHeaders = [
  "Ragione sociale",
  "Ragione Sociale",
  "RAGIONE SOCIALE",
  "Cliente",
  "Nome",
  "Azienda",
  "Denominazione",
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
  if (!name) {
    for (const key of keys) {
      const v = String(row[key] ?? "").trim();
      if (v.length >= 3 && /[a-zA-Z]/.test(v) && !/^\d+$/.test(v)) {
        name = v;
        break;
      }
    }
  }
  if (name) excelNames.push(name);
}
console.log("excel names", excelNames.length, "sample", excelNames.slice(0, 8));

for (const needle of ["PAVAN", "ARCA", "TROTTA", "LEONARDO", "FINESTRE"]) {
  const hits = excelNames.filter((n) => n.toUpperCase().includes(needle));
  console.log(`excel ${needle}:`, hits);
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

const brandRows = [];
from = 0;
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,brands(slug)")
    .range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  brandRows.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}

const slugsByCo = new Map();
for (const row of brandRows) {
  const list = slugsByCo.get(row.company_id) ?? [];
  list.push(one(row.brands)?.slug);
  slugsByCo.set(row.company_id, list);
}

const { data: eterya } = await sb.from("brands").select("id").eq("slug", "eterya").maybeSingle();

const byNorm = new Map();
for (const c of companies) {
  for (const key of nameKeys(c.name)) {
    if (!byNorm.has(key)) byNorm.set(key, []);
    const list = byNorm.get(key);
    if (!list.some((x) => x.id === c.id)) list.push(c);
  }
}

let matched = 0;
let already = 0;
let missingLink = 0;
const gapSamples = [];
const unmatched = [];

const uniqueExcel = new Map();
for (const name of excelNames) uniqueExcel.set(normalizeName(name), name);

for (const [norm, original] of uniqueExcel) {
  let matches = byNorm.get(norm) ?? [];
  if (matches.length === 0) {
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
  if (matches.length === 0) {
    unmatched.push(original);
    continue;
  }
  matched += matches.length;
  for (const company of matches) {
    const slugs = new Set(slugsByCo.get(company.id) ?? []);
    if (slugs.has("eterya")) {
      already++;
    } else {
      missingLink++;
      if (gapSamples.length < 50) {
        gapSamples.push({
          excel: original,
          company: company.name,
          id: company.id,
          current: [...slugs],
        });
      }
    }
  }
}

console.log({
  uniqueExcel: uniqueExcel.size,
  matchedCompanies: matched,
  alreadyHaveE: already,
  needELink: missingLink,
  unmatchedExcel: unmatched.length,
});
console.log("\n=== NEED E LINK (sample) ===");
for (const g of gapSamples) console.log(JSON.stringify(g));

console.log("\n=== unmatched excel sample ===");
for (const u of unmatched.slice(0, 20)) console.log(u);

// Focus known
for (const needle of ["pavan", "arca"]) {
  console.log(
    `\nfocus ${needle}`,
    gapSamples.filter((g) => g.excel.toLowerCase().includes(needle) || g.company.toLowerCase().includes(needle))
  );
  console.log(
    "unmatched",
    unmatched.filter((u) => u.toLowerCase().includes(needle))
  );
}
