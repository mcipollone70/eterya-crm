/**
 * Verify ≥3 ZANZAR + ≥3 PALAGINA map payloads after repair.
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
function one(v) {
  return Array.isArray(v) ? v[0] ?? null : v;
}
function relFromCommercial(s) {
  if (s === "cliente") return "customer";
  if (s === "ex_cliente") return "former_customer";
  return "prospect";
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

const { data: brands } = await sb.from("brands").select("id,slug,name");
const bySlug = Object.fromEntries(brands.map((b) => [b.slug, b]));

async function sample(slug, n = 3) {
  const brand = bySlug[slug];
  const { data: links } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary")
    .eq("brand_id", brand.id)
    .limit(40);

  const out = [];
  for (const link of links ?? []) {
    if (out.length >= n) break;
    const { data: co } = await sb
      .from("companies")
      .select(
        "id,name,latitude,longitude,commercial_status,geocode_status,city,province"
      )
      .eq("id", link.company_id)
      .maybeSingle();
    if (!co?.latitude || !co?.longitude) continue;
    if (!["geocoded", "completed"].includes(co.geocode_status)) continue;

    const { data: all } = await sb
      .from("company_brands")
      .select("company_id,brand_id,is_primary,brands(name,slug,color)")
      .eq("company_id", co.id);

    const brandsMapped = (all ?? [])
      .map((row) => {
        const b = one(row.brands);
        if (!b) return null;
        return {
          brand_id: row.brand_id,
          name: b.name,
          slug: b.slug,
          color: b.color,
          is_primary: row.is_primary,
          relationship_status: relFromCommercial(co.commercial_status),
        };
      })
      .filter(Boolean);

    const payload = {
      company_id: co.id,
      name: co.name,
      coords: { lat: co.latitude, lng: co.longitude },
      commercial_status: co.commercial_status,
      geocode_status: co.geocode_status,
      brands: brandsMapped,
      map_initials: brandsMapped.map(initial).join(""),
    };
    out.push(payload);
  }
  return out;
}

const z = await sample("zanzar", 3);
const p = await sample("palagina", 3);
console.log("=== ZANZAR SAMPLES ===");
console.log(JSON.stringify(z, null, 2));
console.log("=== PALAGINA SAMPLES ===");
console.log(JSON.stringify(p, null, 2));

for (const slug of ["zanzar", "palagina", "eterya"]) {
  const { count } = await sb
    .from("company_brands")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", bySlug[slug].id);
  console.log("count", slug, count);
}

const zOk = z.length >= 3 && z.every((x) => x.map_initials.includes("Z"));
const pOk = p.length >= 3 && p.every((x) => x.map_initials.includes("P"));
console.log("VERIFY", { zOk, pOk, zCount: z.length, pCount: p.length });
