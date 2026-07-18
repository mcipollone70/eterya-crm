/**
 * Targeted repair: add missing ETERYA link on FINESTRE LEONARDO
 * (commercial_status=cliente, already has ZANZAR+PALAGINA).
 * Sets ETERYA as primary so marker initials become EPZ.
 *
 * Run: DRY_RUN=0 node scripts/repair-leonardo-eterya-link.mjs
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

const LEONARDO_ID = "a30d6c38-60bc-48e7-9de4-805b09e6f186";
const ETERYA_ID = "f9a1cfc7-e5e9-4545-99d5-2a2fb1d2ba14";
const DRY_RUN = process.env.DRY_RUN !== "0";

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

console.log(DRY_RUN ? "MODE=DRY_RUN (set DRY_RUN=0 to write)" : "MODE=WRITE");

const { data: before, error: beforeErr } = await sb
  .from("company_brands")
  .select("company_id,brand_id,is_primary,brands(name,slug)")
  .eq("company_id", LEONARDO_ID);
if (beforeErr) {
  console.error(beforeErr);
  process.exit(1);
}
console.log("BEFORE", JSON.stringify(before, null, 2));

const hasEterya = (before ?? []).some((r) => r.brand_id === ETERYA_ID);
if (hasEterya) {
  console.log("ETERYA already linked — nothing to do");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("Would: demote primary on existing rows, insert ETERYA is_primary=true");
  process.exit(0);
}

const { error: demoteErr } = await sb
  .from("company_brands")
  .update({ is_primary: false })
  .eq("company_id", LEONARDO_ID)
  .eq("is_primary", true);
if (demoteErr) {
  console.error("DEMOTE", demoteErr);
  process.exit(1);
}

const { error: insertErr } = await sb.from("company_brands").insert({
  company_id: LEONARDO_ID,
  brand_id: ETERYA_ID,
  is_primary: true,
});
if (insertErr) {
  console.error("INSERT", insertErr);
  process.exit(1);
}

const { data: after } = await sb
  .from("company_brands")
  .select("company_id,brand_id,is_primary,brands(name,slug)")
  .eq("company_id", LEONARDO_ID);
console.log("AFTER", JSON.stringify(after, null, 2));
console.log("OK — Leonardo now has", after?.length ?? 0, "brand associations");
