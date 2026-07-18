/**
 * Probe OPERAI / same-VAT / same-address twins for Pavan, Arca, Newlamplast.
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

function normVat(v) {
  return String(v ?? "").replace(/\D/g, "");
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

for (const p of ["%PAVAN%", "%ARCA%", "%NEWLAMPLAST%", "%OPERAI%"]) {
  const { data } = await sb
    .from("companies")
    .select("id,name,vat_number,phone,email,latitude,longitude,address,street,city")
    .ilike("name", p)
    .limit(40);
  console.log("\nSEARCH", p, "count", (data ?? []).length);
  for (const c of data ?? []) {
    const { data: brands } = await sb
      .from("company_brands")
      .select("is_primary,brands(slug,name)")
      .eq("company_id", c.id);
    console.log({
      name: c.name,
      id: c.id,
      vat: c.vat_number,
      email: c.email,
      lat: c.latitude,
      lng: c.longitude,
      brands: (brands ?? []).map((b) => one(b.brands)?.slug),
    });
  }
}

// Same VAT as Pavan / Arca
for (const vat of ["07490181000", "7490181000", "02800130599", "2800130599"]) {
  const { data } = await sb
    .from("companies")
    .select("id,name,vat_number,latitude,longitude")
    .or(`vat_number.eq.${vat},vat_number.eq.${vat.replace(/^0/, "")}`);
  // also try ilike
  const { data: d2 } = await sb
    .from("companies")
    .select("id,name,vat_number,latitude,longitude,email")
    .ilike("vat_number", `%${vat.replace(/^0+/, "")}%`);
  console.log("\nVAT", vat, "exact", data, "ilike", d2);
}

// Email match
for (const email of ["info@ferramentapavan.it", "arcagroupsc@gmail.com"]) {
  const { data } = await sb
    .from("companies")
    .select("id,name,vat_number,latitude,longitude,email")
    .ilike("email", email);
  console.log("\nEMAIL", email, data);
  for (const c of data ?? []) {
    const { data: brands } = await sb
      .from("company_brands")
      .select("brands(slug)")
      .eq("company_id", c.id);
    console.log("  brands", (brands ?? []).map((b) => one(b.brands)?.slug));
  }
}

// How many eterya companies total vs excel 50
const { data: eterya } = await sb.from("brands").select("id").eq("slug", "eterya").maybeSingle();
const { count } = await sb
  .from("company_brands")
  .select("*", { count: "exact", head: true })
  .eq("brand_id", eterya.id);
console.log("\nETERYA links in DB", count);
