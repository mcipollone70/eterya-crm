/**
 * Simulate map attach payload for TROTTA / LEONARDO via same aggregation helpers.
 * Run: npx --yes tsx scripts/simulate-map-attach-payload.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  aggregateMapCompanyBrands,
  mergeTwinMapCompanyBrands,
} from "../features/maps/utils/map-company-brands-aggregate";
import { resolveMapBrandMarkerVisual } from "../features/maps/utils/map-brand-markers";
import type { MapCompany, MapCompanyBrand } from "../features/maps/types/map";
import { normalizeCommercialStatus } from "../lib/constants/commercial-status";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

const ids = [
  "52b73ac2-c71e-4996-b02c-b708080aea94",
  "3bd3e268-833d-4127-bbdd-411c13819017",
  "a30d6c38-60bc-48e7-9de4-805b09e6f186",
];

const { data: cos } = await sb
  .from("companies")
  .select("id,name,latitude,longitude,commercial_status,geocode_status,city,province")
  .in("id", ids);

const { data: brandRows } = await sb
  .from("company_brands")
  .select("company_id,brand_id,is_primary,brands(name,slug,color)")
  .in("company_id", ids);

const byId = new Map<string, MapCompanyBrand[]>();
for (const row of brandRows ?? []) {
  const b = one(
    row.brands as
      | { name: string; slug: string; color: string | null }
      | { name: string; slug: string; color: string | null }[]
      | null
  );
  if (!b) continue;
  const mapped: MapCompanyBrand = {
    brand_id: row.brand_id,
    name: b.name,
    slug: b.slug,
    color: b.color,
    is_primary: row.is_primary,
    relationship_status: "customer",
    customer_code: null,
  };
  const list = byId.get(row.company_id) ?? [];
  list.push(mapped);
  byId.set(row.company_id, list);
}

const companies: MapCompany[] = (cos ?? []).map((c) => ({
  id: c.id,
  name: c.name,
  address: null,
  phone: null,
  city: c.city,
  province: c.province,
  commercial_status: normalizeCommercialStatus(c.commercial_status),
  geocode_status: c.geocode_status,
  latitude: Number(c.latitude),
  longitude: Number(c.longitude),
  brands: aggregateMapCompanyBrands(byId.get(c.id) ?? []),
}));

const merged = mergeTwinMapCompanyBrands(companies);
for (const c of merged) {
  const visual = resolveMapBrandMarkerVisual(c.brands);
  console.log({
    name: c.name,
    id: c.id,
    brands: c.brands?.map((b) => ({ slug: b.slug, primary: b.is_primary })),
    initials: visual.initials,
    crown: visual.showCrown,
  });
}
