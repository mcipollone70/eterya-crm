/**
 * Probe real company_brands for TROTTA / FINESTRE LEONARDO / multibrand.
 * Run: node scripts/probe-multibrand-map.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function one(v) {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const MAP = { zanzar: "Z", palagina: "P", eterya: "E", "tempra-glass": "T" };
function norm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
function initial(b) {
  return MAP[norm(b.slug)] || MAP[norm(b.name)] || (b.name?.[0] ?? "?").toUpperCase();
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: process.env.PROBE_EMAIL || "eterya.tester3@gmail.com",
  password: process.env.PROBE_PASSWORD || "TestPassword123!",
});
if (authErr) {
  console.error("AUTH", authErr.message);
  process.exit(1);
}

const patterns = ["%TROTTA%", "%LEONARDO%", "%FINESTRE%"];
const companies = [];
for (const p of patterns) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,commercial_status,latitude,longitude,city,province,geocode_status")
    .ilike("name", p);
  if (error) console.error("search err", p, error.message);
  for (const c of data ?? []) {
    if (!companies.find((x) => x.id === c.id)) companies.push(c);
  }
}
console.log("=== MATCHED COMPANIES ===");
console.log(JSON.stringify(companies, null, 2));

async function dumpBrands(companyId, label) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary,created_at,brands(id,name,slug)")
    .eq("company_id", companyId);
  console.log(`\n=== BRANDS ${label} (${companyId}) ===`);
  if (error) console.log("ERROR", error);
  const rows = (data ?? []).map((row) => {
    const b = one(row.brands);
    return {
      company_id: row.company_id,
      brand_id: row.brand_id,
      name: b?.name ?? null,
      slug: b?.slug ?? null,
      is_primary: row.is_primary,
      created_at: row.created_at,
    };
  });
  console.log(JSON.stringify(rows, null, 2));
  // duplicate brand_ids?
  const ids = rows.map((r) => r.brand_id);
  const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
  console.log("duplicates brand_id:", dups);
  console.log("map_initials_if_all:", rows.map((r) => initial(r)).join(""));
  return rows;
}

for (const c of companies) {
  await dumpBrands(c.id, c.name);
}

// Paginate ALL company_brands to find true multibrand
const byCo = new Map();
let from = 0;
const pageSize = 1000;
let totalFetched = 0;
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary,created_at,brands(name,slug)")
    .range(from, from + pageSize - 1);
  if (error) {
    console.error("page err", error);
    break;
  }
  const page = data ?? [];
  totalFetched += page.length;
  for (const row of page) {
    const list = byCo.get(row.company_id) ?? [];
    list.push(row);
    byCo.set(row.company_id, list);
  }
  if (page.length < pageSize) break;
  from += pageSize;
}

const { count } = await sb
  .from("company_brands")
  .select("*", { count: "exact", head: true });
console.log("\nTOTAL company_brands count", count, "fetched", totalFetched);

const multi = [...byCo.entries()]
  .filter(([, rows]) => rows.length >= 2)
  .sort((a, b) => b[1].length - a[1].length);

console.log("MULTIBRAND companies (>=2):", multi.length);

const sampleIds = multi.slice(0, 15).map(([id]) => id);
const { data: sampleCos } = await sb
  .from("companies")
  .select("id,name,commercial_status,latitude,longitude")
  .in("id", sampleIds);
const nameById = Object.fromEntries((sampleCos ?? []).map((c) => [c.id, c]));

console.log("\n=== TOP MULTIBRAND SAMPLE ===");
for (const [id, rows] of multi.slice(0, 15)) {
  const co = nameById[id];
  const brands = rows.map((r) => {
    const b = one(r.brands);
    return {
      brand_id: r.brand_id,
      name: b?.name,
      slug: b?.slug,
      is_primary: r.is_primary,
      created_at: r.created_at,
    };
  });
  console.log(
    JSON.stringify(
      {
        company_id: id,
        name: co?.name,
        commercial_status: co?.commercial_status,
        brand_count: brands.length,
        brands,
        map_initials: brands.map((b) => initial(b)).join(""),
      },
      null,
      2
    )
  );
}

// Specifically check TROTTA / LEONARDO in multi set
for (const needle of ["TROTTA", "LEONARDO", "FINESTRE"]) {
  const hits = multi.filter(([id]) => {
    const n = nameById[id]?.name ?? "";
    return n.toUpperCase().includes(needle);
  });
  // also search all companies in byCo via name lookup for matched companies list
  const fromSearch = companies.filter((c) =>
    c.name.toUpperCase().includes(needle)
  );
  console.log(
    `\nneedle ${needle}: in top-named sample ${hits.length}; from name search:`,
    fromSearch.map((c) => ({
      id: c.id,
      name: c.name,
      brand_count: byCo.get(c.id)?.length ?? 0,
    }))
  );
}

// Simulate attachBrands without pagination (bug candidate): chunk of 80 companies
// Take all company ids that have coords from a bounds-like set — use first 200 companies with coords
const { data: mapCos } = await sb
  .from("companies")
  .select("id,name")
  .not("latitude", "is", null)
  .not("longitude", "is", null)
  .order("name")
  .range(0, 199);

const ids = (mapCos ?? []).map((c) => c.id);
const chunk = ids.slice(0, 80);
const { data: noRange, error: nrErr } = await sb
  .from("company_brands")
  .select("company_id,brand_id,is_primary,brands(name,slug)")
  .in("company_id", chunk);
console.log("\n=== SIMULATE attach chunk80 NO range ===");
console.log("error", nrErr?.message ?? null, "rows", noRange?.length);

// Count how many brands per company in noRange
const sim = new Map();
for (const row of noRange ?? []) {
  const list = sim.get(row.company_id) ?? [];
  list.push(row);
  sim.set(row.company_id, list);
}
const multiInChunk = [...sim.entries()].filter(([, r]) => r.length >= 2);
console.log(
  "companies in chunk with brands",
  sim.size,
  "multibrand in result",
  multiInChunk.length
);

// Check if TROTTA/LEONARDO are in chunk and what they got
for (const c of companies) {
  const got = sim.get(c.id);
  if (got) {
    console.log(
      "IN CHUNK",
      c.name,
      got.map((r) => one(r.brands)?.slug)
    );
  } else {
    console.log("NOT IN FIRST CHUNK80", c.name, c.id);
  }
}

