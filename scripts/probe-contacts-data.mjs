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

const email = `probe2-${Date.now()}@example.com`;
const { data: signUp } = await supabase.auth.signUp({ email, password: "ProbeTest123!" });
const token = signUp.session?.access_token;
const authed = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});

const withContactName = await authed
  .from("companies")
  .select("id,name,contact_name,contact_email,contact_phone,contact_role", { count: "exact" })
  .not("contact_name", "is", null)
  .neq("contact_name", "")
  .limit(5);

console.log("companies with contact_name", {
  count: withContactName.count,
  sample: withContactName.data,
  error: withContactName.error,
});

const contactsCount = await authed.from("contacts").select("id", { count: "exact", head: true });
console.log("contacts table count", contactsCount.count, contactsCount.error);

// Try insert a test contact for first company
const companyId = withContactName.data?.[0]?.id;
if (companyId) {
  const inserted = await authed.from("contacts").insert({
    company_id: companyId,
    full_name: "Probe Referent",
    is_primary: true,
  }).select("id,full_name,company:companies(name)").single();
  console.log("insert probe contact", inserted);

  const listed = await authed
    .from("contacts")
    .select("id,full_name,company_id,company:companies(name)", { count: "exact" })
    .limit(5);
  console.log("list after insert", listed);

  if (inserted.data?.id) {
    await authed.from("contacts").delete().eq("id", inserted.data.id);
    console.log("cleaned up probe contact");
  }
}
