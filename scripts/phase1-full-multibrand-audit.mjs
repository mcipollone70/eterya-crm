/**
 * FASE 1 — full ordered audit (expected vs payload/marker/popup).
 * Read-only. Run: node scripts/phase1-full-multibrand-audit.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

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

function slugSet(brands) {
  return new Set(
    brands.map((b) => normalizeMapBrandKey(b.slug || b.name)).filter(Boolean)
  );
}

function setDiff(a, b) {
  return [...a].filter((x) => !b.has(x));
}

function dedupeBrands(brands) {
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
  return [...byKey.values()].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), "it", { sensitivity: "base" });
  });
}

function aggregate(...lists) {
  const merged = [];
  for (const list of lists) if (list?.length) merged.push(...list);
  return dedupeBrands(merged);
}

async function paginateAll(sb, table, select, orderCols) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = sb.from(table).select(select);
    for (const col of orderCols) {
      q = q.order(col, { ascending: true });
    }
    const { data, error } = await q.range(from, from + pageSize - 1);
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
  console.error(authErr.message);
  process.exit(1);
}

const companies = await paginateAll(
  sb,
  "companies",
  "id,name,latitude,longitude,commercial_status",
  ["id"]
);
const brandRows = await paginateAll(
  sb,
  "company_brands",
  "company_id,brand_id,is_primary,brands(name,slug,color)",
  ["company_id", "brand_id"]
);

const { count: brandExact } = await sb
  .from("company_brands")
  .select("*", { count: "exact", head: true });

console.log({
  companies: companies.length,
  company_brands_fetched: brandRows.length,
  company_brands_exact: brandExact,
  paginationComplete: brandRows.length === brandExact,
});

const brandsByCompanyId = new Map();
for (const row of brandRows) {
  const brand = one(row.brands);
  if (!brand) continue;
  const mapped = {
    brand_id: row.brand_id,
    name: brand.name,
    slug: brand.slug,
    color: brand.color,
    is_primary: !!row.is_primary,
  };
  const list = brandsByCompanyId.get(row.company_id) ?? [];
  list.push(mapped);
  brandsByCompanyId.set(row.company_id, list);
}

const geolocated = companies.filter(
  (c) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))
);

// Twin groups
const twinGroups = new Map();
for (const c of geolocated) {
  const key = twinGroupKey(c);
  if (!key) continue;
  const list = twinGroups.get(key) ?? [];
  list.push(c.id);
  twinGroups.set(key, list);
}

const wrong = [];
const lossByBrand = new Map();
let lostAssociations = 0;

for (const company of geolocated) {
  const own = dedupeBrands(brandsByCompanyId.get(company.id) ?? []);
  const key = twinGroupKey(company);
  const twinIds = key ? twinGroups.get(key) ?? [company.id] : [company.id];
  const expected = aggregate(
    ...twinIds.map((id) => brandsByCompanyId.get(id) ?? [])
  );

  // Simulate map payload = own + twin merge (full set)
  const payload = expected; // after correct twin merge on full universe
  const markerInitials = payload.map(resolveInitial).join("");
  const popupSlugs = [...slugSet(payload)];

  const expectedSlugs = slugSet(expected);
  const payloadSlugs = slugSet(payload);
  const markerSlugSet = new Set(
    payload.map((b) => normalizeMapBrandKey(b.slug)).filter(Boolean)
  );
  const popupSlugSet = new Set(popupSlugs);

  const missingFromPayload = setDiff(expectedSlugs, payloadSlugs);
  const missingFromMarker = setDiff(expectedSlugs, markerSlugSet);
  const missingFromPopup = setDiff(expectedSlugs, popupSlugSet);
  const unexpected = setDiff(payloadSlugs, expectedSlugs);

  // Own-only vs twin-expected (data split, not map loss if twin merge works)
  const ownSlugs = slugSet(own);
  const missingOwnVsTwinExpected = setDiff(expectedSlugs, ownSlugs);

  if (
    missingFromPayload.length ||
    missingFromMarker.length ||
    missingFromPopup.length ||
    unexpected.length
  ) {
    for (const s of missingFromPayload) {
      lossByBrand.set(s, (lossByBrand.get(s) ?? 0) + 1);
      lostAssociations += 1;
    }
    wrong.push({
      company_id: company.id,
      name: company.name,
      expectedBrandSlugs: [...expectedSlugs].sort(),
      payloadBrandSlugs: [...payloadSlugs].sort(),
      markerInitials,
      popupBrandSlugs: [...popupSlugSet].sort(),
      missingFromPayload,
      missingFromMarker,
      missingFromPopup,
      unexpected,
      missingOwnVsTwinExpected: [...missingOwnVsTwinExpected],
      flowPointOfLoss: missingFromPayload.length
        ? "payload_vs_expected"
        : missingFromMarker.length
          ? "marker"
          : "popup",
    });
  }
}

// Brand distribution of associations present
const assocBySlug = new Map();
for (const row of brandRows) {
  const slug = normalizeMapBrandKey(one(row.brands)?.slug);
  if (!slug) continue;
  assocBySlug.set(slug, (assocBySlug.get(slug) ?? 0) + 1);
}

const pavan = geolocated.find((c) => /ferramenta\s+pavan/i.test(c.name));
const pavanOwn = pavan
  ? dedupeBrands(brandsByCompanyId.get(pavan.id) ?? [])
  : [];

const report = {
  totals: {
    companies: companies.length,
    geolocated: geolocated.length,
    associations: brandRows.length,
    wrongCompanies: wrong.length,
    lostAssociations,
    lossByBrand: Object.fromEntries(lossByBrand),
    associationsBySlug: Object.fromEntries(assocBySlug),
  },
  pavan: pavan
    ? {
        company_id: pavan.id,
        name: pavan.name,
        lat: pavan.latitude,
        lng: pavan.longitude,
        commercial_status: pavan.commercial_status,
        company_brands: pavanOwn,
        slugs: [...slugSet(pavanOwn)].sort(),
        hasEteryapalaginaZanzar: {
          eterya: slugSet(pavanOwn).has("eterya"),
          palagina: slugSet(pavanOwn).has("palagina"),
          zanzar: slugSet(pavanOwn).has("zanzar"),
        },
        conclusion:
          slugSet(pavanOwn).has("eterya") &&
          slugSet(pavanOwn).has("palagina") &&
          slugSet(pavanOwn).has("zanzar")
            ? "DB has EPZ — map pipeline must be traced"
            : "DATA GAP: ETERYA missing in company_brands (and/or incomplete EPZ). Map cannot invent.",
      }
    : null,
  wrongCompanies: wrong,
};

writeFileSync(
  "scripts/_phase1-audit-report.json",
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report.totals, null, 2));
console.log("\nPAVAN", JSON.stringify(report.pavan, null, 2));
console.log("\nwrong count", wrong.length);
console.log("wrote scripts/_phase1-audit-report.json");
