/**
 * Data repair: ensure company_brands links for ZANZAR / PALAGINA from source Excel files.
 * Does NOT modify importer code — only inserts missing brand associations.
 *
 * Run: node scripts/repair-zp-brand-links.mjs
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
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Chiavi di match: nome pieno + nome senza codice numerico finale. */
function nameKeys(value) {
  const full = normalizeName(value);
  const keys = new Set();
  if (full) keys.add(full);
  const stripped = full.replace(/\s+\d{3,}$/g, "").trim();
  if (stripped && stripped !== full) keys.add(stripped);
  return [...keys];
}

function readNamesFromExcel(path, nameHeaders) {
  const wb = xlsx.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const names = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    let name = "";
    for (const header of nameHeaders) {
      const key = keys.find(
        (k) => k.trim().toLowerCase() === header.toLowerCase()
      );
      if (key && String(row[key]).trim()) {
        name = String(row[key]).trim();
        break;
      }
    }
    if (!name) {
      // fallback: first non-empty string cell that looks like a company name
      for (const key of keys) {
        const v = String(row[key] ?? "").trim();
        if (v.length >= 3 && /[a-zA-Z]/.test(v) && !/^\d+$/.test(v)) {
          name = v;
          break;
        }
      }
    }
    if (name) names.push(name);
  }
  return names;
}

const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DRY_RUN = process.env.DRY_RUN !== "0";
const email = process.env.PROBE_EMAIL || "eterya.tester3@gmail.com";
const password = process.env.PROBE_PASSWORD || "TestPassword123!";
const { error: authErr } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (authErr) {
  console.error("AUTH FAILED", authErr.message);
  process.exit(1);
}
console.log(DRY_RUN ? "MODE=DRY_RUN (set DRY_RUN=0 to write)" : "MODE=WRITE");

const { data: brands, error: brandsErr } = await supabase
  .from("brands")
  .select("id,name,slug");
if (brandsErr) {
  console.error(brandsErr);
  process.exit(1);
}
const brandBySlug = Object.fromEntries(
  (brands ?? []).map((b) => [b.slug, b])
);

const zanzarPath = "C:/Users/Marco/Desktop/clienti Zanzar.xls";
const palaginaPath = "C:/Users/Marco/Desktop/anagrafica clienti palagina.xls";

const zanzarNames = readNamesFromExcel(zanzarPath, [
  "Ragione sociale",
  "Ragione Sociale",
  "RAGIONE SOCIALE",
  "Cliente",
  "Nome",
]);
const palaginaNames = readNamesFromExcel(palaginaPath, [
  "Ragione sociale",
  "Ragione Sociale",
  "RAGIONE SOCIALE",
  "Cliente",
  "Nome",
  "Azienda",
]);

console.log("Excel names:", {
  zanzar: zanzarNames.length,
  palagina: palaginaNames.length,
  zanzarSample: zanzarNames.slice(0, 5),
  palaginaSample: palaginaNames.slice(0, 5),
});

// Load all companies (id, name) for matching
const companies = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status")
    .order("name", { ascending: true })
    .range(from, from + 999);
  if (error) {
    console.error(error);
    process.exit(1);
  }
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

async function existingBrandIds(companyId) {
  const { data } = await supabase
    .from("company_brands")
    .select("brand_id")
    .eq("company_id", companyId);
  return new Set((data ?? []).map((r) => r.brand_id));
}

async function ensureBrandLinks(excelNames, brandSlug, label) {
  const brand = brandBySlug[brandSlug];
  if (!brand) {
    console.error("Missing brand", brandSlug);
    return { matched: 0, linked: 0, already: 0, missing: 0 };
  }

  let matched = 0;
  let linked = 0;
  let already = 0;
  let missing = 0;
  const linkedSamples = [];
  const missingSamples = [];

  const uniqueExcel = new Map();
  for (const name of excelNames) {
    uniqueExcel.set(normalizeName(name), name);
  }

  for (const [norm, original] of uniqueExcel) {
    const exact = byNorm.get(norm) ?? [];
    let matches = exact;
    if (matches.length === 0) {
      const seen = new Set();
      matches = [];
      for (const key of nameKeys(original)) {
        if (key === norm) continue;
        for (const company of byNorm.get(key) ?? []) {
          if (!seen.has(company.id)) {
            seen.add(company.id);
            matches.push(company);
          }
        }
      }
    }
    if (matches.length === 0) {
      missing++;
      if (missingSamples.length < 8) missingSamples.push(original);
      continue;
    }
    matched += matches.length;

    for (const company of matches) {
      const existing = await existingBrandIds(company.id);
      if (existing.has(brand.id)) {
        already++;
        continue;
      }
      const isPrimary = existing.size === 0;
      if (!DRY_RUN) {
        const { error } = await supabase.from("company_brands").insert({
          company_id: company.id,
          brand_id: brand.id,
          is_primary: isPrimary,
        });
        if (error) {
          console.error("insert fail", company.name, error.message);
          continue;
        }
      }
      linked++;
      if (linkedSamples.length < 5) {
        linkedSamples.push({
          company_id: company.id,
          name: company.name,
          coords:
            company.latitude != null
              ? { lat: company.latitude, lng: company.longitude }
              : null,
          slug: brandSlug,
          is_primary: isPrimary,
        });
      }
    }
  }

  console.log(`\n=== ${label} (${brandSlug}) ===`);
  console.log({ matched, linked, already, missing });
  console.log("linked samples", linkedSamples);
  console.log("missing samples", missingSamples);
  return { matched, linked, already, missing, linkedSamples };
}

const zResult = await ensureBrandLinks(zanzarNames, "zanzar", "ZANZAR");
const pResult = await ensureBrandLinks(palaginaNames, "palagina", "PALAGINA");

// Final counts
for (const slug of ["zanzar", "palagina", "eterya"]) {
  const { count } = await supabase
    .from("company_brands")
    .select("company_id", { count: "exact", head: true })
    .eq("brand_id", brandBySlug[slug].id);
  console.log("FINAL", slug, count);
}

console.log("DONE", { zResult, pResult });
