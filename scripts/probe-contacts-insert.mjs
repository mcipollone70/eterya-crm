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
const email = `probe3-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signUp.session.access_token}` } },
});

const company = await authed.from("companies").select("id,name").limit(1).single();
console.log("company", company.data);

const inserted = await authed.from("contacts").insert({
  company_id: company.data.id,
  full_name: "Mario Rossi Test",
  email: "mario@test.it",
  role: "Direttore",
  is_primary: true,
}).select("id").single();
console.log("insert", inserted);

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

const list = await authed
  .from("contacts")
  .select(LIST_COLUMNS, { count: "exact" })
  .order("full_name", { ascending: true })
  .limit(200);
console.log("listContacts equivalent", list);

// cleanup
if (inserted.data?.id) {
  await authed.from("contacts").delete().eq("id", inserted.data.id);
}
