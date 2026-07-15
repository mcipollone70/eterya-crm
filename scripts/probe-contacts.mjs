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

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

async function probe(label, fn) {
  const result = await fn();
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
}

await probe("anon listContacts embed", async () => {
  const { data, count, error, status, statusText } = await supabase
    .from("contacts")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("full_name", { ascending: true })
    .limit(5);
  return { status, statusText, count, error, rows: data?.length ?? 0, sample: data?.[0] ?? null };
});

await probe("anon listContacts no embed", async () => {
  const { data, count, error, status } = await supabase
    .from("contacts")
    .select("id,full_name,company_id", { count: "exact" })
    .order("full_name", { ascending: true })
    .limit(5);
  return { status, count, error, rows: data?.length ?? 0, sample: data?.[0] ?? null };
});

await probe("anon head count only", async () => {
  const { count, error, status } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });
  return { status, count, error };
});
