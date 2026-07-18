/**
 * FASE 1 — re-verify Pavan company_brands with live-safe columns.
 * Run: node scripts/phase1-pavan-db-verify.mjs
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

const PAVAN_ID = "8075315d-cb8e-4fb1-8a0d-be090f909bf7";

const { data: company, error: coErr } = await sb
  .from("companies")
  .select(
    "id,name,latitude,longitude,commercial_status,geocode_status,city,province,created_at,import_headers,import_payload"
  )
  .eq("id", PAVAN_ID)
  .maybeSingle();
console.log("COMPANY", coErr ?? company);

const { data: brandsAll } = await sb.from("brands").select("id,name,slug,color,created_at");
console.log("\nALL BRANDS", brandsAll);

const { data: cb, error: cbErr } = await sb
  .from("company_brands")
  .select("company_id,brand_id,is_primary,created_at,brands(id,name,slug,color)")
  .eq("company_id", PAVAN_ID)
  .order("brand_id", { ascending: true });
console.log("\nPAVAN company_brands error", cbErr);
console.log(
  "PAVAN company_brands rows",
  JSON.stringify(
    (cb ?? []).map((r) => ({
      company_id: r.company_id,
      brand_id: r.brand_id,
      name: one(r.brands)?.name,
      slug: one(r.brands)?.slug,
      is_primary: r.is_primary,
      created_at: r.created_at,
    })),
    null,
    2
  )
);

// Count associations per brand slug (paginated)
const bySlug = new Map();
let from = 0;
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary,brands(slug,name)")
    .order("company_id", { ascending: true })
    .order("brand_id", { ascending: true })
    .range(from, from + 999);
  if (error) {
    console.error("paginate error", error);
    break;
  }
  for (const row of data ?? []) {
    const slug = one(row.brands)?.slug ?? "(null)";
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + 1);
  }
  if ((data ?? []).length < 1000) break;
  from += 1000;
}
console.log("\nASSOC COUNTS BY SLUG", Object.fromEntries(bySlug));

// Search import_payload for eterya evidence on Pavan
const payload = company?.import_payload;
console.log("\nPAVAN import_headers sample", (company?.import_headers ?? []).slice(0, 40));
if (payload && typeof payload === "object") {
  const hits = [];
  for (const [k, v] of Object.entries(payload)) {
    const s = `${k}=${v}`.toLowerCase();
    if (/eterya|zanzar|palagina|brand|marchio|cliente/.test(s)) {
      hits.push([k, v]);
    }
  }
  console.log("PAVAN import_payload brand-related hits:", hits);
} else {
  console.log("PAVAN import_payload empty/null");
}

// Any other company with similar name without "ferramenta"?
const { data: loose } = await sb
  .from("companies")
  .select("id,name,latitude,longitude,commercial_status")
  .or("name.ilike.%pavan%,name.ilike.%5113%");
console.log("\nLOOSE pavan/5113", loose);

// Check customer_code-like fields if any column exists — try select *
const { data: cbStar, error: starErr } = await sb
  .from("company_brands")
  .select("*")
  .eq("company_id", PAVAN_ID);
console.log("\nPAVAN company_brands SELECT *", starErr ?? cbStar);

// Find companies with 3 brands (EPZ)
const multi = [];
from = 0;
const byCo = new Map();
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brands(slug)")
    .order("company_id", { ascending: true })
    .range(from, from + 999);
  if (error) break;
  for (const row of data ?? []) {
    const slug = one(row.brands)?.slug;
    if (!slug) continue;
    const set = byCo.get(row.company_id) ?? new Set();
    set.add(slug);
    byCo.set(row.company_id, set);
  }
  if ((data ?? []).length < 1000) break;
  from += 1000;
}
for (const [id, set] of byCo) {
  if (set.size >= 3) multi.push({ id, slugs: [...set].sort() });
}
console.log("\nCompanies with >=3 brands:", multi.length);
for (const m of multi) {
  const { data: c } = await sb.from("companies").select("id,name").eq("id", m.id).maybeSingle();
  console.log(c?.name, m.slugs.join("+"));
}

console.log("\nDONE");
