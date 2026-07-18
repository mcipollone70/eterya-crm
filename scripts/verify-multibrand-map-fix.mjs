/**
 * Verify map payloads for TROTTA / LEONARDO after repair + twin merge.
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
  return MAP[norm(b.slug)] || MAP[norm(b.name)] || "?";
}

function sortBrands(brands) {
  return [...brands].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
  });
}

function aggregate(...lists) {
  const by = new Map();
  for (const list of lists) {
    for (const b of list) {
      const key = b.brand_id || b.slug;
      const prev = by.get(key);
      if (!prev || (!prev.is_primary && b.is_primary)) by.set(key, b);
    }
  }
  return sortBrands([...by.values()]);
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

async function loadBrands(companyId) {
  const { data } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary,created_at,brands(name,slug,color)")
    .eq("company_id", companyId);
  return (data ?? []).map((row) => {
    const b = one(row.brands);
    return {
      brand_id: row.brand_id,
      name: b?.name,
      slug: b?.slug,
      color: b?.color,
      is_primary: row.is_primary,
      created_at: row.created_at,
    };
  });
}

async function report(label, ids) {
  const companies = [];
  for (const id of ids) {
    const { data: co } = await sb
      .from("companies")
      .select("id,name,latitude,longitude,commercial_status")
      .eq("id", id)
      .maybeSingle();
    const brands = await loadBrands(id);
    companies.push({ ...co, brands });
  }

  // twin merge among this set
  const groups = new Map();
  for (const c of companies) {
    const key = `${coreName(c.name)}|${Number(c.latitude).toFixed(5)},${Number(c.longitude).toFixed(5)}`;
    const list = groups.get(key) ?? [];
    list.push(c.id);
    groups.set(key, list);
  }
  const brandsById = new Map(companies.map((c) => [c.id, c.brands]));
  for (const idsInGroup of groups.values()) {
    if (idsInGroup.length < 2) continue;
    const union = aggregate(...idsInGroup.map((id) => brandsById.get(id) ?? []));
    for (const id of idsInGroup) brandsById.set(id, union);
  }

  console.log(`\n=== ${label} ===`);
  for (const c of companies) {
    const finalBrands = brandsById.get(c.id) ?? c.brands;
    console.log(
      JSON.stringify(
        {
          company_id: c.id,
          name: c.name,
          db_brands: c.brands,
          final_map_brands: finalBrands,
          map_initials: finalBrands.map(initial).join(""),
        },
        null,
        2
      )
    );
  }
}

await report("TROTTA", [
  "52b73ac2-c71e-4996-b02c-b708080aea94",
  "3bd3e268-833d-4127-bbdd-411c13819017",
]);
await report("FINESTRE LEONARDO", ["a30d6c38-60bc-48e7-9de4-805b09e6f186"]);

// ≥5 multibrand
const { data: links } = await sb
  .from("company_brands")
  .select("company_id")
  .limit(2000);
const counts = new Map();
for (const row of links ?? []) {
  counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
}
const multiIds = [...counts.entries()]
  .filter(([, n]) => n >= 2)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([id]) => id);
console.log("\n=== MULTIBRAND SAMPLE (>=2) ===");
for (const id of multiIds) {
  const { data: co } = await sb.from("companies").select("id,name").eq("id", id).maybeSingle();
  const brands = await loadBrands(id);
  console.log({
    id,
    name: co?.name,
    brands: brands.map((b) => b.slug),
    initials: brands.map(initial).join(""),
  });
}
