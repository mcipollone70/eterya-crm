/**
 * Find ETERYA evidence for FINESTRE LEONARDO + duplicate pairs splitting brands.
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

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Core identity: strip trailing numeric codes and legal suffixes noise for grouping. */
function coreName(value) {
  return normalizeName(value)
    .replace(/\s+\d{3,}$/g, "")
    .replace(/\b(srl|spa|snc|sas|ss|soc|cooperativa|unipersonale|semplificata|a responsabilita limitata)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

// Leonardo full row
const { data: leo } = await sb
  .from("companies")
  .select("*")
  .eq("id", "a30d6c38-60bc-48e7-9de4-805b09e6f186")
  .maybeSingle();
console.log("LEONARDO full keys", Object.keys(leo ?? {}));
console.log({
  name: leo?.name,
  vat: leo?.vat_number,
  address: leo?.address,
  street: leo?.street,
  city: leo?.city,
  phone: leo?.phone,
  email: leo?.email,
  lat: leo?.latitude,
  lng: leo?.longitude,
  payload: leo?.import_payload,
});

// Search same VAT / city / coords neighborhood
if (leo?.vat_number) {
  const { data } = await sb
    .from("companies")
    .select("id,name,vat_number,commercial_status")
    .eq("vat_number", leo.vat_number);
  console.log("same VAT", data);
}

const { data: sameCity } = await sb
  .from("companies")
  .select("id,name,vat_number,latitude,longitude,address,street")
  .eq("city", "Velletri")
  .ilike("name", "%LEONARDO%");
console.log("Velletri LEONARDO", sameCity);

// Find companies with ETERYA brand whose core name is finestre leonardo / leonardo
const { data: eteryaBrand } = await sb
  .from("brands")
  .select("id")
  .eq("slug", "eterya")
  .maybeSingle();

const { data: eteryaLinks } = await sb
  .from("company_brands")
  .select("company_id")
  .eq("brand_id", eteryaBrand.id);
const eteryaIds = (eteryaLinks ?? []).map((r) => r.company_id);

// batch fetch names
const eteryaCos = [];
for (let i = 0; i < eteryaIds.length; i += 80) {
  const chunk = eteryaIds.slice(i, i + 80);
  const { data } = await sb.from("companies").select("id,name,city,vat_number").in("id", chunk);
  eteryaCos.push(...(data ?? []));
}
const leoHits = eteryaCos.filter((c) => {
  const n = normalizeName(c.name);
  return n.includes("leonardo") || n.includes("finestre");
});
console.log("ETERYA companies with leonardo/finestre:", leoHits);

// Duplicate analysis: same core name, different ids, split brands
const companies = [];
let from = 0;
while (true) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status,vat_number,city")
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
    .select("company_id,brand_id,is_primary,brands(name,slug)")
    .range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  brandRows.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}

const brandsByCo = new Map();
for (const row of brandRows) {
  const list = brandsByCo.get(row.company_id) ?? [];
  list.push({
    brand_id: row.brand_id,
    slug: one(row.brands)?.slug,
    is_primary: row.is_primary,
  });
  brandsByCo.set(row.company_id, list);
}

const byCore = new Map();
for (const c of companies) {
  const core = coreName(c.name);
  if (!core || core.length < 4) continue;
  if (!byCore.has(core)) byCore.set(core, []);
  byCore.get(core).push(c);
}

const splitGroups = [];
for (const [core, group] of byCore) {
  if (group.length < 2) continue;
  const brandSets = group.map((c) => ({
    id: c.id,
    name: c.name,
    slugs: (brandsByCo.get(c.id) ?? []).map((b) => b.slug).sort(),
    lat: c.latitude,
    lng: c.longitude,
  }));
  const allSlugs = new Set(brandSets.flatMap((x) => x.slugs));
  const anyPartial = brandSets.some(
    (x) => x.slugs.length > 0 && x.slugs.length < allSlugs.size
  );
  if (allSlugs.size >= 2 && anyPartial) {
    splitGroups.push({ core, allSlugs: [...allSlugs], brandSets });
  }
}

console.log("\nSPLIT BRAND GROUPS (same core name, brands split across duplicates):", splitGroups.length);
for (const g of splitGroups.slice(0, 30)) {
  console.log(JSON.stringify(g, null, 2));
}

// Also same lat/lng within 1e-5
const byCoord = new Map();
for (const c of companies) {
  if (c.latitude == null || c.longitude == null) continue;
  const key = `${Number(c.latitude).toFixed(5)},${Number(c.longitude).toFixed(5)}`;
  if (!byCoord.has(key)) byCoord.set(key, []);
  byCoord.get(key).push(c);
}
const coordSplits = [];
for (const [coord, group] of byCoord) {
  if (group.length < 2) continue;
  const brandSets = group.map((c) => ({
    id: c.id,
    name: c.name,
    slugs: (brandsByCo.get(c.id) ?? []).map((b) => b.slug).sort(),
  }));
  const allSlugs = new Set(brandSets.flatMap((x) => x.slugs));
  const anyPartial = brandSets.some(
    (x) => x.slugs.length > 0 && x.slugs.length < allSlugs.size
  );
  if (allSlugs.size >= 2 && anyPartial) {
    coordSplits.push({ coord, allSlugs: [...allSlugs], brandSets });
  }
}
console.log("\nCOORD SPLIT GROUPS:", coordSplits.length);
for (const g of coordSplits.slice(0, 25)) {
  console.log(JSON.stringify(g, null, 2));
}
