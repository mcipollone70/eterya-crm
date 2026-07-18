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

const INITIAL = { zanzar: "Z", palagina: "P", eterya: "E", "tempra-glass": "T" };
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

for (const q of ["Pavan", "Trotta", "Leonardo", "Arca"]) {
  const { data, error } = await sb
    .from("companies")
    .select("id,name,commercial_status")
    .ilike("name", `%${q}%`)
    .limit(8);
  if (error) {
    console.log(q, "ERR", error.message);
    continue;
  }
  if (!data?.length) {
    console.log(q, "NOT FOUND");
    continue;
  }
  for (const c of data) {
    const { data: cb, error: cbErr } = await sb
      .from("company_brands")
      .select("is_primary,brands(name,slug)")
      .eq("company_id", c.id);
    if (cbErr) {
      console.log(q, c.name, "CB ERR", cbErr.message);
      continue;
    }
    const slugs = (cb ?? [])
      .map((r) => one(r.brands)?.slug)
      .filter(Boolean)
      .sort();
    const initials = slugs.map((s) => INITIAL[s] || "?").join("");
    console.log(
      `${q}: ${c.name} | ${c.commercial_status} | ${slugs.join(",") || "(none)"} | ${initials || "-"}`
    );
  }
}

const { count: companies } = await sb.from("companies").select("id", { count: "exact", head: true });
const { count: associations } = await sb
  .from("company_brands")
  .select("company_id", { count: "exact", head: true });
console.log(`TOTAL companies=${companies} associations=${associations}`);

const probe = await sb.from("company_brands").select("relationship_status").limit(1);
console.log(
  "relationship_status column:",
  probe.error ? `ABSENT (${probe.error.code || ""} ${probe.error.message})` : "PRESENT"
);
