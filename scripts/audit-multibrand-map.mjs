/**
 * Full DB audit: companies ↔ company_brands ↔ map payload (twin-aware).
 * Pagina TUTTE le aziende e associazioni (niente first-1000).
 *
 * Run: node scripts/audit-multibrand-map.mjs
 * Optional: KNOWN_ONLY=1 for Pavan/Arca/Trotta/Leonardo sample dump
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
    .replace(/\bs\s*\.?\s*a\s*\.?\s*s\s*\.?\b/g, " sas ")
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

function dedupeBrands(brands) {
  const byKey = new Map();
  for (const brand of brands) {
    const idKey = brand.brand_id?.trim();
    const slugKey = normalizeMapBrandKey(brand.slug || brand.name);
    const key = idKey ? `id:${idKey}` : `slug:${slugKey}`;
    if (!key || key === "id:" || key === "slug:") continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, brand);
      continue;
    }
    if (!existing.is_primary && brand.is_primary) {
      byKey.set(key, brand);
    }
  }
  const ordered = [...byKey.values()].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), "it", { sensitivity: "base" });
  });
  let keptPrimary = false;
  return ordered.map((brand) => {
    if (!brand.is_primary) return brand;
    if (!keptPrimary) {
      keptPrimary = true;
      return brand;
    }
    return { ...brand, is_primary: false };
  });
}

function aggregate(...lists) {
  const merged = [];
  for (const list of lists) {
    if (list?.length) merged.push(...list);
  }
  return dedupeBrands(merged);
}

/** Same as mergeTwinMapCompanyBrands — union brands across twins in set. */
function mergeTwin(companies) {
  const groups = new Map();
  for (const company of companies) {
    const key = twinGroupKey(company);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(company.id);
    groups.set(key, list);
  }
  const brandsById = new Map(companies.map((c) => [c.id, c.brands ?? []]));
  const unionByCompanyId = new Map();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const union = aggregate(...ids.map((id) => brandsById.get(id) ?? []));
    for (const id of ids) unionByCompanyId.set(id, union);
  }
  return companies.map((company) => ({
    ...company,
    brands:
      unionByCompanyId.get(company.id) ?? dedupeBrands(company.brands ?? []),
  }));
}

/**
 * GLOBAL twin-aware expected brands: union across ALL twins in DB
 * (not only those co-loaded in a map page). This is the ground truth for "should show".
 */
function expectedBrandsGlobal(companies, brandsByCompanyId) {
  const groups = new Map();
  for (const company of companies) {
    const key = twinGroupKey(company);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(company.id);
    groups.set(key, list);
  }

  const expected = new Map();
  for (const company of companies) {
    const key = twinGroupKey(company);
    if (!key || !groups.has(key) || groups.get(key).length < 2) {
      expected.set(company.id, dedupeBrands(brandsByCompanyId.get(company.id) ?? []));
      continue;
    }
    const ids = groups.get(key);
    expected.set(
      company.id,
      aggregate(...ids.map((id) => brandsByCompanyId.get(id) ?? []))
    );
  }
  return expected;
}

/**
 * Simulate attach for a page of companies ONLY (current map behavior):
 * own brands + twin merge within page.
 */
function simulatePageAttach(pageCompanies, brandsByCompanyId) {
  const withOwn = pageCompanies.map((c) => ({
    ...c,
    brands: dedupeBrands(brandsByCompanyId.get(c.id) ?? []),
  }));
  return mergeTwin(withOwn);
}

async function paginateAll(sb, table, select, orderCol = "id") {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order(orderCol, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
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

console.log("Loading ALL companies (paginated)...");
const companies = await paginateAll(
  sb,
  "companies",
  "id,name,latitude,longitude,commercial_status,geocode_status,city,province"
);
console.log("companies loaded:", companies.length);

console.log("Loading ALL company_brands (paginated)...");
const brandRows = await paginateAll(
  sb,
  "company_brands",
  "company_id,brand_id,is_primary,brands(name,slug,color)",
  "company_id"
);
console.log("company_brands loaded:", brandRows.length);

const { count: brandCountExact } = await sb
  .from("company_brands")
  .select("*", { count: "exact", head: true });
const { count: companyCountExact } = await sb
  .from("companies")
  .select("*", { count: "exact", head: true });

console.log("exact counts:", { companies: companyCountExact, company_brands: brandCountExact });

if (brandRows.length !== brandCountExact) {
  console.warn("WARN: fetched company_brands != exact count", brandRows.length, brandCountExact);
}
if (companies.length !== companyCountExact) {
  console.warn("WARN: fetched companies != exact count", companies.length, companyCountExact);
}

const brandsByCompanyId = new Map();
const orphanBrandRows = [];
const companyIdSet = new Set(companies.map((c) => c.id));
const unknownSlugRows = [];
const nullSlugRows = [];
const duplicateAssoc = [];

const seenAssocKeys = new Map(); // company_id|brand_id -> count

for (const row of brandRows) {
  const brand = one(row.brands);
  const mapped = {
    brand_id: row.brand_id,
    name: brand?.name ?? null,
    slug: brand?.slug ?? null,
    color: brand?.color ?? null,
    is_primary: !!row.is_primary,
    relationship_status: "prospect",
    customer_code: null,
  };

  if (!companyIdSet.has(row.company_id)) {
    orphanBrandRows.push(row);
  }
  if (!brand) {
    orphanBrandRows.push(row);
  } else {
    const slugKey = normalizeMapBrandKey(brand.slug);
    if (!brand.slug) nullSlugRows.push(row);
    else if (!SLUG_INITIAL[slugKey] && !SLUG_INITIAL[normalizeMapBrandKey(brand.name)]) {
      // unknown slug is OK if name fallback works; track truly unknown
      if (!resolveInitial(mapped) || resolveInitial(mapped) === "?") {
        unknownSlugRows.push({ ...row, mapped });
      }
    }
  }

  const assocKey = `${row.company_id}|${row.brand_id}`;
  seenAssocKeys.set(assocKey, (seenAssocKeys.get(assocKey) ?? 0) + 1);

  const list = brandsByCompanyId.get(row.company_id) ?? [];
  list.push(mapped);
  brandsByCompanyId.set(row.company_id, list);
}

for (const [key, n] of seenAssocKeys) {
  if (n > 1) duplicateAssoc.push({ key, n });
}

const geolocated = companies.filter(
  (c) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
);

const expectedGlobal = expectedBrandsGlobal(geolocated, brandsByCompanyId);

// Simulate map attach for ALL geolocated in one "page" (best case twin merge within set)
const simulatedAllInOne = simulatePageAttach(
  geolocated.map((c) => ({ ...c, brands: [] })),
  brandsByCompanyId
);
const simById = new Map(simulatedAllInOne.map((c) => [c.id, c]));

// Simulate WITHOUT twin merge (own brands only) — shows raw DB incompleteness
const ownOnlyMissing = [];
const afterTwinInPageMissing = [];
const twinSplitCases = [];

const brandCountBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, "5+": 0 };

for (const company of geolocated) {
  const expected = expectedGlobal.get(company.id) ?? [];
  const own = dedupeBrands(brandsByCompanyId.get(company.id) ?? []);
  const afterTwin = simById.get(company.id)?.brands ?? own;

  const expectedSlugs = new Set(expected.map((b) => normalizeMapBrandKey(b.slug || b.name)).filter(Boolean));
  const ownSlugs = new Set(own.map((b) => normalizeMapBrandKey(b.slug || b.name)).filter(Boolean));
  const twinSlugs = new Set(afterTwin.map((b) => normalizeMapBrandKey(b.slug || b.name)).filter(Boolean));

  const n = expectedSlugs.size;
  if (n >= 5) brandCountBuckets["5+"]++;
  else brandCountBuckets[String(n)] = (brandCountBuckets[String(n)] ?? 0) + 1;

  const missingOwn = [...expectedSlugs].filter((s) => !ownSlugs.has(s));
  const missingTwin = [...expectedSlugs].filter((s) => !twinSlugs.has(s));
  const unexpectedTwin = [...twinSlugs].filter((s) => !expectedSlugs.has(s));

  if (missingOwn.length) {
    ownOnlyMissing.push({
      id: company.id,
      name: company.name,
      expected: [...expectedSlugs],
      own: [...ownSlugs],
      missing: missingOwn,
      initialsExpected: expected.map(resolveInitial).join(""),
      initialsOwn: own.map(resolveInitial).join(""),
    });
  }
  if (missingTwin.length || unexpectedTwin.length) {
    afterTwinInPageMissing.push({
      id: company.id,
      name: company.name,
      expected: [...expectedSlugs],
      payload: [...twinSlugs],
      missing: missingTwin,
      unexpected: unexpectedTwin,
    });
  }

  // Twin split: own incomplete vs global expected
  const twinKey = twinGroupKey(company);
  if (twinKey && missingOwn.length && expectedSlugs.size > ownSlugs.size) {
    twinSplitCases.push({
      id: company.id,
      name: company.name,
      twinKey,
      expected: [...expectedSlugs],
      own: [...ownSlugs],
      missing: missingOwn,
      initialsExpected: expected.map(resolveInitial).join(""),
      initialsOwn: own.map(resolveInitial).join(""),
      lat: company.latitude,
      lng: company.longitude,
    });
  }
}

// Known cases
const KNOWN = ["PAVAN", "ARCA", "TROTTA", "LEONARDO", "FINESTRE"];
function dumpKnown(label, needle) {
  const hits = geolocated.filter((c) => c.name.toUpperCase().includes(needle));
  console.log(`\n=== KNOWN ${label} (${hits.length} hits) ===`);
  for (const c of hits) {
    const expected = expectedGlobal.get(c.id) ?? [];
    const own = dedupeBrands(brandsByCompanyId.get(c.id) ?? []);
    const after = simById.get(c.id)?.brands ?? own;
    console.log(
      JSON.stringify(
        {
          id: c.id,
          name: c.name,
          lat: c.latitude,
          lng: c.longitude,
          twinKey: twinGroupKey(c),
          ownSlugs: own.map((b) => b.slug),
          expectedSlugs: expected.map((b) => b.slug),
          afterTwinMergeSlugs: after.map((b) => b.slug),
          initialsOwn: own.map(resolveInitial).join(""),
          initialsExpected: expected.map(resolveInitial).join(""),
          initialsAfterTwin: after.map(resolveInitial).join(""),
          missingOwnVsExpected: expected
            .map((b) => normalizeMapBrandKey(b.slug))
            .filter((s) => !own.map((b) => normalizeMapBrandKey(b.slug)).includes(s)),
        },
        null,
        2
      )
    );
  }
}

for (const needle of ["PAVAN", "ARCA", "TROTTA", "LEONARDO"]) {
  dumpKnown(needle, needle);
}

// Multi-brand with single letter if twin merge NOT applied (page without twin)
const multiAssocSingleLetter = twinSplitCases.filter(
  (c) => c.expected.length >= 2 && c.own.length === 1
);

// Geolocated companies missing from a "full Italy" payload simulation = 0 by construction
// Companies with valid coords but empty brands when expected has brands
const lostOnMapIfNoTwin = ownOnlyMissing.length;

console.log("\n========== AUDIT SUMMARY ==========");
const summary = {
  totalCompanies: companies.length,
  totalCompanyBrands: brandRows.length,
  geolocated: geolocated.length,
  brandCountBuckets,
  orphanBrandRows: orphanBrandRows.length,
  nullSlugRows: nullSlugRows.length,
  unknownSlugRows: unknownSlugRows.length,
  duplicateAssoc: duplicateAssoc.length,
  /** Own company_brands incomplete vs twin-union expected (GENERAL DATA/TWIN cause) */
  companiesWithIncompleteOwnBrandsVsTwinUnion: ownOnlyMissing.length,
  /** After in-memory twin merge on FULL geolocated set — should be 0 if twins share coords+core */
  companiesMissingAfterFullTwinMerge: afterTwinInPageMissing.length,
  twinSplitCases: twinSplitCases.length,
  multiAssocWithSingleOwnBrand: multiAssocSingleLetter.length,
};
console.log(JSON.stringify(summary, null, 2));

console.log("\n=== TOP twin-split incomplete (own vs expected) ===");
for (const row of twinSplitCases.slice(0, 40)) {
  console.log(
    `${row.name} | own=${row.own.join(",")} expected=${row.expected.join(",")} missing=${row.missing.join(",")} | ${row.initialsOwn}→${row.initialsExpected}`
  );
}

if (afterTwinInPageMissing.length) {
  console.log("\n=== STILL MISSING AFTER FULL TWIN MERGE (unexpected) ===");
  for (const row of afterTwinInPageMissing.slice(0, 20)) {
    console.log(JSON.stringify(row));
  }
}

// Count unique twin groups with split brands
const splitGroupKeys = new Set(twinSplitCases.map((c) => c.twinKey));
console.log("\nunique twin groups with split brands:", splitGroupKeys.size);

console.log("\nDONE");
