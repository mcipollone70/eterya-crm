/**
 * Probe Pavan/Arca ETERYA evidence and twin name normalization gaps.
 * Run: node scripts/probe-pavan-arca-eterya.mjs
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

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

for (const p of ["%pavan%", "%arca group%", "%ferramenta%"]) {
  const { data } = await sb
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status")
    .ilike("name", p);
  console.log(
    "\nSEARCH",
    p,
    (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      core: coreName(c.name),
      lat: c.latitude,
      lng: c.longitude,
      status: c.commercial_status,
    }))
  );
}

const { data: eterya } = await sb
  .from("brands")
  .select("id,slug,name")
  .eq("slug", "eterya")
  .maybeSingle();
console.log("\nETERYA brand", eterya);

const { data: nearPavan } = await sb
  .from("companies")
  .select("id,name,latitude,longitude")
  .gte("latitude", 41.941)
  .lte("latitude", 41.943)
  .gte("longitude", 12.369)
  .lte("longitude", 12.371);
console.log("\nNEAR PAVAN", nearPavan);

const { data: nearArca } = await sb
  .from("companies")
  .select("id,name,latitude,longitude")
  .gte("latitude", 41.466)
  .lte("latitude", 41.468)
  .gte("longitude", 12.902)
  .lte("longitude", 12.905);
console.log("\nNEAR ARCA", nearArca);

let from = 0;
const eteryaLinks = [];
while (true) {
  const { data, error } = await sb
    .from("company_brands")
    .select("company_id,brand_id,is_primary,brands(slug)")
    .eq("brand_id", eterya.id)
    .range(from, from + 999);
  if (error) {
    console.error(error);
    break;
  }
  eteryaLinks.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
  from += 1000;
}
console.log("\nETERYA associations", eteryaLinks.length);

const ids = eteryaLinks.map((r) => r.company_id);
const cos = [];
for (let i = 0; i < ids.length; i += 80) {
  const { data } = await sb
    .from("companies")
    .select("id,name,latitude,longitude,commercial_status")
    .in("id", ids.slice(i, i + 80));
  cos.push(...(data ?? []));
}
const hits = cos.filter((c) => /pavan|arca|ferramenta/i.test(c.name));
console.log("ETERYA companies matching pavan/arca/ferramenta", hits);

for (const id of [
  "8075315d-cb8e-4fb1-8a0d-be090f909bf7",
  "360aee6f-e939-4b5e-a59f-b6287739ed5e",
]) {
  const { data } = await sb
    .from("companies")
    .select("id,name,import_payload,import_headers,commercial_status")
    .eq("id", id)
    .maybeSingle();
  console.log("\nDETAIL", data?.name, "status", data?.commercial_status);
  console.log("headers sample", (data?.import_headers ?? []).slice(0, 30));
  const payload = data?.import_payload;
  if (payload && typeof payload === "object") {
    for (const [k, v] of Object.entries(payload)) {
      const s = String(v).toLowerCase();
      if (
        /eterya|zanzar|palagina|brand|marchio/.test(k.toLowerCase()) ||
        /eterya|zanzar|palagina/.test(s)
      ) {
        console.log("  hit", k, "=", v);
      }
    }
  }

  const { data: brands } = await sb
    .from("company_brands")
    .select("is_primary,brands(name,slug)")
    .eq("company_id", id);
  console.log(
    "brands",
    (brands ?? []).map((b) => ({
      slug: one(b.brands)?.slug,
      name: one(b.brands)?.name,
      primary: b.is_primary,
    }))
  );
}

// Check if any company shares same coords as Pavan/Arca with different name
for (const [label, lat, lng] of [
  ["PAVAN", 41.9419985, 12.3701454],
  ["ARCA", 41.467299, 12.9037518],
]) {
  const keyLat = Number(lat).toFixed(5);
  const keyLng = Number(lng).toFixed(5);
  const { data } = await sb
    .from("companies")
    .select("id,name,latitude,longitude")
    .gte("latitude", Number(keyLat) - 0.00001)
    .lte("latitude", Number(keyLat) + 0.00001)
    .gte("longitude", Number(keyLng) - 0.00001)
    .lte("longitude", Number(keyLng) + 0.00001);
  console.log(`\nSAME COORD ${label}`, data);
}
