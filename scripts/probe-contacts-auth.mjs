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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anonKey);

const email = `probe-${Date.now()}@example.com`;
const password = "ProbeTest123!";

const signUp = await supabase.auth.signUp({ email, password });
console.log("signUp", { error: signUp.error, user: signUp.data.user?.id, session: !!signUp.data.session });

let session = signUp.data.session;
if (!session) {
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  session = signIn.data.session;
  console.log("signIn", { error: signIn.error, session: !!session });
}

if (!session) {
  console.log("No session - cannot probe authenticated queries");
  process.exit(1);
}

const authed = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
});

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

for (const label of ["embed", "no-embed", "companies-key"]) {
  let q = authed.from("contacts");
  if (label === "embed") q = q.select(LIST_COLUMNS, { count: "exact" });
  else if (label === "no-embed") q = q.select("id,full_name,company_id", { count: "exact" });
  else q = q.select("id,full_name,company_id,companies(name)", { count: "exact" });

  const { data, count, error } = await q.order("full_name", { ascending: true }).limit(5);
  console.log(`\n=== ${label} ===`, { count, rows: data?.length ?? 0, error, sample: data?.[0] ?? null });
}

const companies = await authed.from("companies").select("id,name,contact_name", { count: "exact", head: false }).limit(3);
console.log("\n=== companies sample ===", { count: companies.count, rows: companies.data?.length, error: companies.error, sample: companies.data });
