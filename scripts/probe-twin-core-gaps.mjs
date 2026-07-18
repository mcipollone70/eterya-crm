/**
 * Find companies that SHOULD have ETERYA from twin/name patterns
 * but don't; also test dotted s.r.l. core-name gaps.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

function coreNameOld(value) {
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

/** Improved: collapse dotted legal forms s.r.l. / s.r.l before token strip */
function coreNameNew(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\s*s?\b/g, "srl")
    .replace(/\bs\s*\.?\s*p\s*\.?\s*a\s*\.?\b/g, "spa")
    .replace(/\bs\s*\.?\s*n\s*\.?\s*c\s*\.?\b/g, "snc")
    .replace(/\bs\s*\.?\s*a\s*\.?\s*s\s*\.?\b/g, "sas")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+\d{3,}$/g, "")
    .replace(
      /\b(srl|srls|spa|snc|sas|ss|soc|cooperativa|unipersonale|semplificata|a responsabilita limitata)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

console.log("coreName compare:");
for (const n of [
  "FERRAMENTA PAVAN s.r.l. 5113",
  "FERRAMENTA PAVAN SRL",
  "ARCA GROUP SOC. COOP. 5206",
  "ARCA GROUP SOC COOP",
  "TROTTA SRL 13408",
  "TROTTA SRL",
]) {
  console.log({ n, old: coreNameOld(n), neu: coreNameNew(n) });
}

// Load all companies + brands
const companies = [];
let from = 0;
while (true) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status,vat_number,phone,email")
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

const { data: brands } = await sb.from("brands").select("id,slug,name");
const slugById = Object.fromEntries((brands ?? []).map((b) => [b.id, b.slug]));
const eteryaId = (brands ?? []).find((b) => b.slug === "eterya")?.id;

// Twin groups with OLD vs NEW core — count how many more merges NEW finds
function groupByCore(fn) {
  const groups = new Map();
  for (const c of companies) {
    if (c.latitude == null || c.longitude == null) continue;
    const core = fn(c.name);
    if (!core || core.length < 3) continue;
    const key = `${core}|${Number(c.latitude).toFixed(5)},${Number(c.longitude).toFixed(5)}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return groups;
}

const oldG = groupByCore(coreNameOld);
const newG = groupByCore(coreNameNew);
const oldTwins = [...oldG.values()].filter((g) => g.length >= 2).length;
const newTwins = [...newG.values()].filter((g) => g.length >= 2).length;
console.log({ oldTwins, newTwins, newExtra: newTwins - oldTwins });

// Split brands under NEW core
const newSplits = [];
for (const [key, group] of newG) {
  if (group.length < 2) continue;
  const sets = group.map((c) => ({
    id: c.id,
    name: c.name,
    slugs: (brandsByCo.get(c.id) ?? []).map((b) => b.slug).sort(),
  }));
  const all = new Set(sets.flatMap((x) => x.slugs));
  const partial = sets.some((x) => x.slugs.length > 0 && x.slugs.length < all.size);
  if (all.size >= 2 && partial) {
    newSplits.push({ key, all: [...all], sets });
  }
}
console.log("NEW core twin brand splits:", newSplits.length);
for (const s of newSplits.slice(0, 25)) console.log(JSON.stringify(s, null, 2));

// Look for VAT matches: eterya-linked company sharing VAT with ZP-only company
const byVat = new Map();
for (const c of companies) {
  const vat = (c.vat_number || "").replace(/\s/g, "");
  if (!vat || vat.length < 8) continue;
  const list = byVat.get(vat) ?? [];
  list.push(c);
  byVat.set(vat, list);
}

const vatSplits = [];
for (const [vat, group] of byVat) {
  if (group.length < 2) continue;
  const sets = group.map((c) => ({
    id: c.id,
    name: c.name,
    slugs: (brandsByCo.get(c.id) ?? []).map((b) => b.slug).sort(),
    lat: c.latitude,
    lng: c.longitude,
  }));
  const all = new Set(sets.flatMap((x) => x.slugs));
  const partial = sets.some((x) => x.slugs.length > 0 && x.slugs.length < all.size);
  if (all.size >= 2 && partial) {
    vatSplits.push({ vat, all: [...all], sets });
  }
}
console.log("VAT twin brand splits:", vatSplits.length);
for (const s of vatSplits.slice(0, 30)) console.log(JSON.stringify(s, null, 2));

// ZP companies that might need E: same numeric suffix pattern as eterya-only?
// Find all multi-brand ZP without E, and all E-only companies — fuzzy name match
function tokens(name) {
  return coreNameNew(name)
    .split(" ")
    .filter((t) => t.length >= 4);
}

const withE = companies.filter((c) =>
  (brandsByCo.get(c.id) ?? []).some((b) => b.slug === "eterya")
);
const withZPNoE = companies.filter((c) => {
  const slugs = new Set((brandsByCo.get(c.id) ?? []).map((b) => b.slug));
  return (slugs.has("zanzar") || slugs.has("palagina")) && !slugs.has("eterya");
});

console.log({ withE: withE.length, withZPNoE: withZPNoE.length });

const fuzzy = [];
for (const zp of withZPNoE) {
  const zt = new Set(tokens(zp.name));
  if (zt.size === 0) continue;
  for (const e of withE) {
    const et = tokens(e.name);
    const overlap = et.filter((t) => zt.has(t));
    if (overlap.length >= 2 || (overlap.length === 1 && overlap[0].length >= 6)) {
      fuzzy.push({
        zp: zp.name,
        zpId: zp.id,
        zpSlugs: (brandsByCo.get(zp.id) ?? []).map((b) => b.slug),
        e: e.name,
        eId: e.id,
        eSlugs: (brandsByCo.get(e.id) ?? []).map((b) => b.slug),
        overlap,
      });
    }
  }
}
console.log("fuzzy ZP↔E name overlaps:", fuzzy.length);
for (const f of fuzzy.slice(0, 40)) console.log(JSON.stringify(f));

// Specifically Pavan / Arca token overlap
for (const needle of ["pavan", "arca"]) {
  const zp = withZPNoE.filter((c) => c.name.toLowerCase().includes(needle));
  const e = withE.filter((c) => c.name.toLowerCase().includes(needle));
  console.log(`needle ${needle}: ZP-noE`, zp.map((c) => c.name), "E", e.map((c) => c.name));
}

// Search desktop for excel mentioning PAVAN
const desktop = "C:\\Users\\Marco\\Desktop";
try {
  const files = readdirSync(desktop).filter((f) => /\.(xlsx|xls|csv)$/i.test(f));
  console.log("desktop data files", files);
} catch (e) {
  console.log("desktop list fail", e.message);
}
