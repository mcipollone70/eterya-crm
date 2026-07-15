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
const email = `probe6-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signUp.session.access_token}` } },
});

const rows = await authed
  .from("companies")
  .select("id,name,import_headers,import_payload")
  .not("import_headers", "is", null)
  .limit(5);

for (const row of rows.data ?? []) {
  const headers = row.import_headers ?? [];
  const payload = row.import_payload ?? {};
  const idx = headers.findIndex((h) => /NOME CAPO GRUPPO/i.test(String(h)));
  const key = idx >= 0 ? headers[idx] : null;
  const value = key ? payload[key] : null;
  console.log({ company: row.name, key, value });
}

const countRes = await authed
  .from("companies")
  .select("id,import_headers,import_payload", { count: "exact" })
  .not("import_headers", "is", null)
  .limit(2501);

let withReferent = 0;
for (const row of countRes.data ?? []) {
  const headers = row.import_headers ?? [];
  const payload = row.import_payload ?? {};
  const idx = headers.findIndex((h) => /NOME CAPO GRUPPO/i.test(String(h)));
  if (idx >= 0) {
    const value = String(payload[headers[idx]] ?? "").trim();
    if (value) withReferent++;
  }
}
console.log("\nTotal companies:", countRes.data?.length, "count:", countRes.count);
console.log("With NOME CAPO GRUPPO value:", withReferent);
