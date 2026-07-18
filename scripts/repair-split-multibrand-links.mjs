/**
 * Data repair: unisce company_brands tra aziende twin
 * (stesso core name + stesse coordinate).
 * Non modifica importer né schema.
 *
 * Run: DRY_RUN=0 node scripts/repair-split-multibrand-links.mjs
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

function coreName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+\d{3,}$/g, "")
    .replace(
      /\b(srl|spa|snc|sas|ss|soc|cooperativa|unipersonale|semplificata|a responsabilita limitata)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function coordKey(lat, lng) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
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

const companies = [];
let from = 0;
while (true) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,latitude,longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("id")
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

const brandRows = [];
from = 0;
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary")
    .range(from, from + 999);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  if (!data?.length) break;
  brandRows.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}

const brandsByCo = new Map();
for (const row of brandRows) {
  const list = brandsByCo.get(row.company_id) ?? [];
  list.push(row);
  brandsByCo.set(row.company_id, list);
}

const groups = new Map();
for (const c of companies) {
  const core = coreName(c.name);
  if (!core || core.length < 3) continue;
  const key = `${core}|${coordKey(c.latitude, c.longitude)}`;
  const list = groups.get(key) ?? [];
  list.push(c);
  groups.set(key, list);
}

let inserted = 0;
let skipped = 0;
const samples = [];

for (const [key, group] of groups) {
  if (group.length < 2) continue;

  const unionBrandIds = new Map(); // brand_id -> { is_primary }
  for (const c of group) {
    for (const row of brandsByCo.get(c.id) ?? []) {
      const prev = unionBrandIds.get(row.brand_id);
      if (!prev) {
        unionBrandIds.set(row.brand_id, { is_primary: row.is_primary });
      } else if (row.is_primary) {
        unionBrandIds.set(row.brand_id, { is_primary: true });
      }
    }
  }
  if (unionBrandIds.size < 2) continue;

  const anyPartial = group.some((c) => {
    const have = new Set((brandsByCo.get(c.id) ?? []).map((r) => r.brand_id));
    return [...unionBrandIds.keys()].some((id) => !have.has(id));
  });
  if (!anyPartial) continue;

  for (const c of group) {
    const existing = new Set((brandsByCo.get(c.id) ?? []).map((r) => r.brand_id));
    for (const [brandId, meta] of unionBrandIds) {
      if (existing.has(brandId)) {
        skipped++;
        continue;
      }
      const isPrimary = existing.size === 0 && meta.is_primary;
      if (!DRY_RUN) {
        const { error } = await sb.from("company_brands").insert({
          company_id: c.id,
          brand_id: brandId,
          is_primary: isPrimary,
        });
        if (error) {
          console.error("insert fail", c.name, brandId, error.message);
          continue;
        }
      }
      inserted++;
      existing.add(brandId);
      const list = brandsByCo.get(c.id) ?? [];
      list.push({ company_id: c.id, brand_id: brandId, is_primary: isPrimary });
      brandsByCo.set(c.id, list);
      if (samples.length < 20) {
        samples.push({
          key,
          company_id: c.id,
          name: c.name,
          brand_id: brandId,
          is_primary: isPrimary,
        });
      }
    }
  }
}

console.log({ inserted, skipped, sampleCount: samples.length });
console.log("samples", JSON.stringify(samples, null, 2));

// Verify TROTTA + LEONARDO
for (const needle of ["TROTTA SRL", "FINESTRE LEONARDO"]) {
  const { data: cos } = await sb
    .from("companies")
    .select("id,name")
    .ilike("name", `%${needle}%`);
  for (const c of cos ?? []) {
    const { data: brands } = await sb
      .from("company_brands")
      .select("is_primary,brands(name,slug)")
      .eq("company_id", c.id);
    console.log(
      "VERIFY",
      c.name,
      (brands ?? []).map((b) => ({
        slug: Array.isArray(b.brands) ? b.brands[0]?.slug : b.brands?.slug,
        primary: b.is_primary,
      }))
    );
  }
}
