import { createServerClient } from "@supabase/ssr";
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
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createServerClient(url, key, {
  cookies: {
    getAll() { return []; },
    setAll() {},
  },
});

const LIST_COLUMNS =
  "id,full_name,role,email,phone,mobile,is_primary,company_id,company:companies(name)";

const result = await supabase
  .from("contacts")
  .select(LIST_COLUMNS, { count: "exact" })
  .order("full_name", { ascending: true })
  .limit(200);

function describeDbError(error) {
  if (!error) return null;
  if (error.code === "42501" || /permission denied|row-level security/i.test(error.message)) {
    return "Accesso al database negato...";
  }
  return error.message;
}

const errorMsg = describeDbError(result.error);
console.log({
  status: result.status,
  count: result.count,
  rows: result.data?.length ?? 0,
  rawError: result.error,
  describeDbError: errorMsg,
  wouldShowEmpty: !errorMsg && (result.data ?? []).length === 0,
  wouldShowError: !!errorMsg,
});
