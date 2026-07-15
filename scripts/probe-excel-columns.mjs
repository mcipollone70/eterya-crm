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
const email = `probe5-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signUp.session.access_token}` } },
});

const sample = await authed
  .from("companies")
  .select("name,import_headers,import_payload,col_01,col_02,col_03,col_04,col_05,col_06,col_07,col_08,col_09,col_10")
  .limit(3);

console.log(JSON.stringify(sample.data, null, 2));

const headersCount = await authed.from("companies").select("import_headers").not("import_headers", "is", null).limit(100);
const headerHits = new Map();
for (const row of headersCount.data ?? []) {
  for (const h of row.import_headers ?? []) {
    if (/refer|contatt|contact|person|nome/i.test(String(h))) {
      headerHits.set(h, (headerHits.get(h) ?? 0) + 1);
    }
  }
}
console.log("referent-like headers in first 100 companies:", [...headerHits.entries()].slice(0, 20));
