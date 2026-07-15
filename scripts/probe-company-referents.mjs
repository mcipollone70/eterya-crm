import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const email = `probe4-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signUp.session.access_token}` } },
});

const sample = await authed
  .from("companies")
  .select("id,name,contact_name,contact_email,contact_phone,contact_role,import_payload,import_headers")
  .limit(5);

for (const row of sample.data ?? []) {
  const payload = row.import_payload ?? {};
  const keys = Object.keys(payload).filter((k) => /refer|contatt|contact|person/i.test(k));
  console.log("\n", row.name);
  console.log(" structured:", {
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    contact_role: row.contact_role,
  });
  if (keys.length) console.log(" payload referent keys:", keys.map((k) => [k, payload[k]]));
}

const withPayloadReferent = await authed
  .from("companies")
  .select("id,name,import_payload")
  .not("import_payload", "is", null)
  .limit(200);

let hits = 0;
for (const row of withPayloadReferent.data ?? []) {
  const payload = row.import_payload ?? {};
  for (const [k, v] of Object.entries(payload)) {
    if (/refer|contatt|contact|person/i.test(k) && String(v ?? "").trim()) {
      hits++;
      if (hits <= 5) console.log("\nHIT", row.name, k, v);
      break;
    }
  }
}
console.log("\ncompanies with referent-like payload fields (sample 200):", hits);
