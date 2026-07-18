/**
 * Search Leonardo / TROTTA evidence across all companies by VAT phone email.
 * Run: node scripts/probe-leonardo-eterya-gap.mjs
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

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

const filters = [
  ["email", "%finestreleonardo%"],
  ["website", "%finestreleonardo%"],
  ["phone", "%96453485%"],
  ["mobile", "%9020880%"],
  ["address", "%CINQUE ARCHI%"],
  ["name", "%LEONARDO%"],
];

for (const [col, val] of filters) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,vat_number,email,phone,city,commercial_status")
    .ilike(col, val);
  console.log(col, val, error?.message ?? null, data);
}

// TROTTA VAT check
const { data: trottas } = await sb
  .from("companies")
  .select("id,name,vat_number,tax_code,phone,email,latitude,longitude")
  .ilike("name", "%TROTTA SRL%");
console.log("TROTTA rows", JSON.stringify(trottas, null, 2));
