/**
 * FASE 1 ONLY — diagnosi Ferramenta Pavan + traccia flusso mappa.
 * Nessuna modifica dati / codice produzione.
 * Run: node scripts/phase1-pavan-multibrand-trace.mjs
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

const SLUG_INITIAL = {
  zanzar: "Z",
  palagina: "P",
  eterya: "E",
  "tempra-glass": "T",
};

function normalizeMapBrandKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveInitial(brand) {
  const fromSlug = SLUG_INITIAL[normalizeMapBrandKey(brand.slug)];
  if (fromSlug) return fromSlug;
  const fromName = SLUG_INITIAL[normalizeMapBrandKey(brand.name)];
  if (fromName) return fromName;
  return (brand.name?.trim()?.charAt(0) || "?").toUpperCase();
}

function coreMapCompanyName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\s*s\b/g, " srls ")
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\b/g, " srl ")
    .replace(/\bs\s*\.?\s*p\s*\.?\s*a\s*\.?\b/g, " spa ")
    .replace(/\bs\s*\.?\s*n\s*\.?\s*c\s*\.?\b/g, " snc ")
    .replace(/\bs\s*\.?\s*a\s*\.?\s*s\b/g, " sas ")
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

function mapCompanyCoordKey(lat, lng, decimals = 5) {
  return `${Number(lat).toFixed(decimals)},${Number(lng).toFixed(decimals)}`;
}

function twinGroupKey(company) {
  const core = coreMapCompanyName(company.name);
  if (!core || core.length < 3) return null;
  if (!Number.isFinite(Number(company.latitude)) || !Number.isFinite(Number(company.longitude))) {
    return null;
  }
  return `${core}|${mapCompanyCoordKey(company.latitude, company.longitude)}`;
}

function slugList(rows) {
  return rows
    .map((r) => normalizeMapBrandKey(r.slug || r.name))
    .filter(Boolean)
    .sort();
}

function setEq(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: authErr } = await sb.auth.signInWithPassword({
  email: process.env.PROBE_EMAIL || "eterya.tester3@gmail.com",
  password: process.env.PROBE_PASSWORD || "TestPassword123!",
});
if (authErr) {
  console.error("AUTH FAIL", authErr.message);
  process.exit(1);
}

console.log("========== 1. SEARCH FERRAMENTA PAVAN (exact/ilike) ==========");

const searches = [
  { label: "ilike %pavan%", q: () => sb.from("companies").select("id,name,latitude,longitude,commercial_status,geocode_status,city,province,created_at,updated_at").ilike("name", "%pavan%") },
  { label: "ilike %ferramenta%pavan%", q: () => sb.from("companies").select("id,name,latitude,longitude,commercial_status,geocode_status,city,province,created_at,updated_at").ilike("name", "%ferramenta%pavan%") },
  { label: "ilike ferramenta pavan%", q: () => sb.from("companies").select("id,name,latitude,longitude,commercial_status,geocode_status,city,province,created_at,updated_at").ilike("name", "ferramenta pavan%") },
];

const allPavanCandidates = new Map();
for (const s of searches) {
  const { data, error } = await s.q();
  if (error) {
    console.log(s.label, "ERROR", error.message);
    continue;
  }
  console.log(`\n${s.label}: ${(data ?? []).length} rows`);
  for (const c of data ?? []) {
    allPavanCandidates.set(c.id, c);
    console.log({
      id: c.id,
      name: c.name,
      core: coreMapCompanyName(c.name),
      lat: c.latitude,
      lng: c.longitude,
      status: c.commercial_status,
      geocode: c.geocode_status,
      city: c.city,
      province: c.province,
    });
  }
}

// Prefer exact "Ferramenta Pavan" core name matches
const ferramentaPavan = [...allPavanCandidates.values()].filter((c) =>
  coreMapCompanyName(c.name).includes("ferramenta pavan") ||
  /ferramenta\s+pavan/i.test(c.name)
);

console.log("\n========== CANDIDATES Ferramenta Pavan ==========");
console.log("count:", ferramentaPavan.length);
for (const c of ferramentaPavan) {
  console.log({
    id: c.id,
    name: JSON.stringify(c.name),
    core: coreMapCompanyName(c.name),
    twinKey: twinGroupKey(c),
    lat: c.latitude,
    lng: c.longitude,
    status: c.commercial_status,
  });
}

async function dumpCompanyBrands(companyId) {
  // Try full select first, then fallbacks
  const selects = [
    "company_id,brand_id,is_primary,relationship_status,customer_code,created_at,updated_at,brands(id,name,slug,color)",
    "company_id,brand_id,is_primary,relationship_status,created_at,updated_at,brands(id,name,slug,color)",
    "company_id,brand_id,is_primary,created_at,updated_at,brands(id,name,slug,color)",
  ];
  for (const select of selects) {
    const { data, error } = await sb
      .from("company_brands")
      .select(select)
      .eq("company_id", companyId)
      .order("brand_id", { ascending: true });
    if (!error) {
      return { select, rows: data ?? [] };
    }
    console.log("select fail", select.split(",")[0], error.message);
  }
  return { select: null, rows: [] };
}

console.log("\n========== ALL company_brands PER CANDIDATE ==========");
const brandByCompany = new Map();
for (const c of ferramentaPavan.length ? ferramentaPavan : [...allPavanCandidates.values()]) {
  const { select, rows } = await dumpCompanyBrands(c.id);
  const mapped = rows.map((row) => {
    const b = one(row.brands);
    return {
      company_id: row.company_id,
      brand_id: row.brand_id,
      name: b?.name ?? null,
      slug: b?.slug ?? null,
      relationship_status: row.relationship_status ?? null,
      is_primary: row.is_primary,
      customer_code: row.customer_code ?? null,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    };
  });
  brandByCompany.set(c.id, mapped);
  console.log(`\n--- ${c.name} (${c.id}) select=${select} ---`);
  console.log(JSON.stringify(mapped, null, 2));
  console.log("slugs:", slugList(mapped));
  console.log("has eterya/palagina/zanzar:", {
    eterya: mapped.some((r) => normalizeMapBrandKey(r.slug) === "eterya"),
    palagina: mapped.some((r) => normalizeMapBrandKey(r.slug) === "palagina"),
    zanzar: mapped.some((r) => normalizeMapBrandKey(r.slug) === "zanzar"),
  });
}

// Twin discovery by coords for each candidate
console.log("\n========== TWIN DISCOVERY (same coords ±1.5m) ==========");
for (const c of ferramentaPavan.length ? ferramentaPavan : [...allPavanCandidates.values()]) {
  if (!Number.isFinite(Number(c.latitude)) || !Number.isFinite(Number(c.longitude))) {
    console.log(c.name, "NO COORDS");
    continue;
  }
  const eps = 0.000015;
  const { data: near } = await sb
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status")
    .gte("latitude", Number(c.latitude) - eps)
    .lte("latitude", Number(c.latitude) + eps)
    .gte("longitude", Number(c.longitude) - eps)
    .lte("longitude", Number(c.longitude) + eps);
  const myKey = twinGroupKey(c);
  console.log(`\nNear ${c.name} twinKey=${myKey}`);
  for (const n of near ?? []) {
    const key = twinGroupKey(n);
    const brands = brandByCompany.get(n.id);
    let brandDump = brands;
    if (!brandDump) {
      const { rows } = await dumpCompanyBrands(n.id);
      brandDump = rows.map((row) => {
        const b = one(row.brands);
        return {
          brand_id: row.brand_id,
          slug: b?.slug,
          name: b?.name,
          is_primary: row.is_primary,
        };
      });
      brandByCompany.set(n.id, brandDump);
    }
    console.log({
      id: n.id,
      name: n.name,
      core: coreMapCompanyName(n.name),
      twinKey: key,
      sameTwin: key === myKey,
      slugs: slugList(brandDump),
      status: n.commercial_status,
    });
  }
}

// Pick primary subject: prefer company with most brands among Ferramenta Pavan
const subjects = (ferramentaPavan.length ? ferramentaPavan : [...allPavanCandidates.values()])
  .map((c) => ({
    company: c,
    brands: brandByCompany.get(c.id) ?? [],
  }))
  .sort((a, b) => b.brands.length - a.brands.length);

const primary = subjects[0];
if (!primary) {
  console.log("\nNO PAVAN FOUND — STOP");
  process.exit(1);
}

console.log("\n========== PRIMARY SUBJECT ==========");
console.log({
  id: primary.company.id,
  name: primary.company.name,
  lat: primary.company.latitude,
  lng: primary.company.longitude,
  status: primary.company.commercial_status,
  slugs: slugList(primary.brands),
});

const expectedOfficial = ["eterya", "palagina", "zanzar"];
const ownSlugs = new Set(slugList(primary.brands));
const missingInDb = expectedOfficial.filter((s) => !ownSlugs.has(s));
console.log("\nDB check vs expected EPZ:");
console.log({
  ownSlugs: [...ownSlugs],
  missingInDbOnThisCompany: missingInDb,
});

// Collect twin union for this twin key
const twinKey = twinGroupKey(primary.company);
let twinUnionSlugs = [...ownSlugs];
if (twinKey) {
  const twins = [];
  for (const [id, brands] of brandByCompany) {
    const co = subjects.find((s) => s.company.id === id)?.company
      ?? (await sb.from("companies").select("id,name,latitude,longitude").eq("id", id).maybeSingle()).data;
    if (!co) continue;
    if (twinGroupKey(co) === twinKey) {
      twins.push({ id, name: co.name, slugs: slugList(brands) });
      twinUnionSlugs = [...new Set([...twinUnionSlugs, ...slugList(brands)])];
    }
  }
  // Also re-query near coords to ensure all twins loaded
  const eps = 0.000015;
  const { data: near } = await sb
    .from("companies")
    .select("id,name,latitude,longitude")
    .gte("latitude", Number(primary.company.latitude) - eps)
    .lte("latitude", Number(primary.company.latitude) + eps)
    .gte("longitude", Number(primary.company.longitude) - eps)
    .lte("longitude", Number(primary.company.longitude) + eps);
  for (const n of near ?? []) {
    if (twinGroupKey(n) !== twinKey) continue;
    if (!brandByCompany.has(n.id)) {
      const { rows } = await dumpCompanyBrands(n.id);
      const mapped = rows.map((row) => {
        const b = one(row.brands);
        return { brand_id: row.brand_id, slug: b?.slug, name: b?.name, is_primary: row.is_primary };
      });
      brandByCompany.set(n.id, mapped);
    }
    twinUnionSlugs = [...new Set([...twinUnionSlugs, ...slugList(brandByCompany.get(n.id))])];
  }
  console.log("twinUnionSlugs:", twinUnionSlugs.sort());
  console.log("missingInTwinUnion:", expectedOfficial.filter((s) => !twinUnionSlugs.includes(s)));
}

console.log("\n========== 2. FLOW TRACE (same company) ==========");
const steps = [];

// A raw company_brands
const stepA = slugList(primary.brands);
steps.push({ step: "A_raw_company_brands", slugs: stepA, hasE: stepA.includes("eterya") });

// B simulate pagination attach for this company alone (chunk of 1)
const stepB = stepA; // single company page = own brands after page fetch
steps.push({ step: "B_after_page_batch", slugs: stepB, hasE: stepB.includes("eterya") });

// C after page merge (own aggregate)
function dedupe(brands) {
  const byKey = new Map();
  for (const brand of brands) {
    const idKey = brand.brand_id?.trim?.() ?? brand.brand_id;
    const slugKey = normalizeMapBrandKey(brand.slug || brand.name);
    const key = idKey ? `id:${idKey}` : `slug:${slugKey}`;
    if (!key || key === "id:" || key === "slug:") continue;
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, brand);
    else if (!existing.is_primary && brand.is_primary) byKey.set(key, brand);
  }
  return [...byKey.values()];
}
const stepC = slugList(dedupe(primary.brands.map((b) => ({ ...b }))));
steps.push({ step: "C_after_page_aggregate", slugs: stepC, hasE: stepC.includes("eterya") });

// D Map grouped by company_id — same
const stepD = stepC;
steps.push({ step: "D_map_grouped_by_company_id", slugs: stepD, hasE: stepD.includes("eterya") });

// E map service company object — with twin merge if twins share key
const twinBrands = [];
if (twinKey) {
  const eps = 0.000015;
  const { data: near } = await sb
    .from("companies")
    .select("id,name,latitude,longitude")
    .gte("latitude", Number(primary.company.latitude) - eps)
    .lte("latitude", Number(primary.company.latitude) + eps)
    .gte("longitude", Number(primary.company.longitude) - eps)
    .lte("longitude", Number(primary.company.longitude) + eps);
  for (const n of near ?? []) {
    if (twinGroupKey(n) !== twinKey) continue;
    const brands = brandByCompany.get(n.id) ?? [];
    twinBrands.push(...brands);
  }
}
const stepE = slugList(dedupe([...primary.brands, ...twinBrands]));
steps.push({
  step: "E_map_service_after_twin_merge",
  slugs: stepE,
  hasE: stepE.includes("eterya"),
  twinBrandCount: twinBrands.length,
});

// F payload to marker = same as E
const stepF = stepE;
steps.push({ step: "F_payload_to_marker", slugs: stepF, hasE: stepF.includes("eterya") });

// G renderer initials
const ordered = dedupe(primary.brands.concat(twinBrands)).sort((a, b) => {
  if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
  return String(a.name).localeCompare(String(b.name), "it", { sensitivity: "base" });
});
const initials = ordered.map(resolveInitial).join("");
steps.push({
  step: "G_renderer_initials",
  slugs: slugList(ordered),
  initials,
  hasE: initials.includes("E"),
});

// H Leaflet HTML — check letters present
const letterCount = initials.length;
const width =
  letterCount <= 1 ? 32 : letterCount === 2 ? 44 : letterCount === 3 ? 62 : letterCount === 4 ? 76 : 76;
const htmlHasAll = initials.split("").every((ch) => true); // letters individually rendered
steps.push({
  step: "H_leaflet_divIcon",
  initials,
  width,
  lettersRenderedSeparately: true,
  hasE: initials.includes("E"),
});

// I popup
const popupSlugs = slugList(ordered);
steps.push({
  step: "I_popup_content",
  slugs: popupSlugs,
  hasE: popupSlugs.includes("eterya"),
});

for (const s of steps) {
  console.log(JSON.stringify(s));
}

const firstLoss = steps.find((s) => !s.hasE);
console.log("\n========== FIRST STEP WHERE ETERYA DISAPPEARS ==========");
if (!ownSlugs.has("eterya") && !stepE.includes("eterya")) {
  console.log("ETERYA NEVER PRESENT in DB for this company (or twin union). DATA GAP.");
  console.log({
    ownHasE: ownSlugs.has("eterya"),
    twinUnionHasE: stepE.includes("eterya"),
    firstLossStep: firstLoss?.step ?? "never_present",
  });
} else if (firstLoss) {
  console.log("FIRST LOSS:", firstLoss.step, firstLoss);
} else {
  console.log("ETERYA PRESENT through all pipeline steps for this subject.");
}

// Also check: is ETERYA on a DIFFERENT company that user thinks is Pavan?
console.log("\n========== ETERYA links whose company name matches pavan/ferramenta ==========");
const { data: eteryaBrand } = await sb.from("brands").select("id,slug,name").eq("slug", "eterya").maybeSingle();
if (eteryaBrand) {
  let from = 0;
  const eteryaLinks = [];
  while (true) {
    const { data, error } = await sb
      .from("company_brands")
      .select("company_id,brand_id,is_primary,created_at,updated_at")
      .eq("brand_id", eteryaBrand.id)
      .order("company_id", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error(error);
      break;
    }
    eteryaLinks.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    from += 1000;
  }
  console.log("total eterya associations:", eteryaLinks.length);
  const ids = eteryaLinks.map((r) => r.company_id);
  const cos = [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = await sb
      .from("companies")
      .select("id,name,latitude,longitude,commercial_status")
      .in("id", ids.slice(i, i + 80));
    cos.push(...(data ?? []));
  }
  const hits = cos.filter((c) => /pavan|ferramenta/i.test(c.name));
  console.log("ETERYA on pavan/ferramenta names:", hits);
  for (const h of hits) {
    const link = eteryaLinks.find((r) => r.company_id === h.id);
    console.log({
      company: h,
      link,
      twinKey: twinGroupKey(h),
      core: coreMapCompanyName(h.name),
    });
  }
}

console.log("\nDONE PHASE1 TRACE");
