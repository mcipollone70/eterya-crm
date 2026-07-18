/**
 * Find duplicate companies + Excel evidence for TROTTA / LEONARDO brand links.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import xlsx from "xlsx";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKeys(value) {
  const full = normalizeName(value);
  const keys = new Set();
  if (full) keys.add(full);
  const stripped = full.replace(/\s+\d{3,}$/g, "").trim();
  if (stripped && stripped !== full) keys.add(stripped);
  // also strip srl/spa etc for looser match
  const loose = stripped
    .replace(/\b(srl|spa|snc|sas|ss|soc|cooperativa|unipersonale|semplificata|a responsabilita limitata)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (loose) keys.add(loose);
  return [...keys];
}

function readNamesFromExcel(path, nameHeaders) {
  if (!existsSync(path)) {
    console.log("MISSING FILE", path);
    return [];
  }
  const wb = xlsx.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const names = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    let name = "";
    for (const header of nameHeaders) {
      const key = keys.find((k) => k.trim().toLowerCase() === header.toLowerCase());
      if (key && String(row[key]).trim()) {
        name = String(row[key]).trim();
        break;
      }
    }
    if (!name) {
      for (const key of keys) {
        const v = String(row[key] ?? "").trim();
        if (v.length >= 3 && /[a-zA-Z]/.test(v) && !/^\d+$/.test(v)) {
          name = v;
          break;
        }
      }
    }
    if (name) names.push(name);
  }
  return names;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
  email: "eterya.tester3@gmail.com",
  password: "TestPassword123!",
});

const needles = ["trotta", "leonardo", "finestre leonardo"];

const zanzarPath = "C:/Users/Marco/Desktop/clienti Zanzar.xls";
const palaginaPath = "C:/Users/Marco/Desktop/anagrafica clienti palagina.xls";

const zNames = readNamesFromExcel(zanzarPath, [
  "Ragione sociale",
  "Ragione Sociale",
  "RAGIONE SOCIALE",
  "Cliente",
  "Nome",
]);
const pNames = readNamesFromExcel(palaginaPath, [
  "Ragione sociale",
  "Ragione Sociale",
  "RAGIONE SOCIALE",
  "Cliente",
  "Nome",
  "Azienda",
]);

console.log("Excel ZANZAR total", zNames.length);
console.log("Excel PALAGINA total", pNames.length);

for (const needle of needles) {
  const zHits = zNames.filter((n) => normalizeName(n).includes(needle));
  const pHits = pNames.filter((n) => normalizeName(n).includes(needle));
  console.log(`\nEXCEL ${needle}: Z=${zHits.length}`, zHits.slice(0, 10));
  console.log(`EXCEL ${needle}: P=${pHits.length}`, pHits.slice(0, 10));
}

// Same coords duplicates for TROTTA coords
const { data: sameCoords } = await sb
  .from("companies")
  .select("id,name,commercial_status,latitude,longitude,city")
  .eq("latitude", 41.40594)
  .eq("longitude", 12.96919);
console.log("\nSAME COORDS as TROTTA:", JSON.stringify(sameCoords, null, 2));

// Search Eterya companies that might be FINESTRE LEONARDO without number
const { data: eteryaLike } = await sb
  .from("companies")
  .select("id,name,commercial_status")
  .or("name.ilike.%LEONARDO%,name.ilike.%FINESTRE%");
console.log("\nALL LEONARDO/FINESTRE companies:");
for (const c of eteryaLike ?? []) {
  const { data: brands } = await sb
    .from("company_brands")
    .select("brand_id,is_primary,brands(name,slug)")
    .eq("company_id", c.id);
  console.log(
    c.name,
    c.id,
    (brands ?? []).map((b) => ({
      slug: Array.isArray(b.brands) ? b.brands[0]?.slug : b.brands?.slug,
      primary: b.is_primary,
    }))
  );
}

// Check company detail source - import_payload brand hints for TROTTA and LEONARDO
for (const id of [
  "52b73ac2-c71e-4996-b02c-b708080aea94",
  "3bd3e268-833d-4127-bbdd-411c13819017",
  "a30d6c38-60bc-48e7-9de4-805b09e6f186",
]) {
  const { data: co } = await sb
    .from("companies")
    .select("id,name,import_headers,import_payload,commercial_status")
    .eq("id", id)
    .maybeSingle();
  console.log("\nIMPORT META", co?.name);
  console.log("headers", co?.import_headers);
  const payload = co?.import_payload;
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload);
    console.log("payload keys sample", keys.slice(0, 30));
    // look for brand-ish fields
    for (const k of keys) {
      if (/brand|marchio|zanzar|palagina|eterya/i.test(k) || /brand|marchio|zanzar|palagina|eterya/i.test(String(payload[k]))) {
        console.log("  hit", k, payload[k]);
      }
    }
  }
}

// Check if repair script would match TROTTA SRL (without number) to ZANZAR excel
const trottaKeys = nameKeys("TROTTA SRL");
const zIndex = new Map();
for (const n of zNames) {
  for (const k of nameKeys(n)) {
    if (!zIndex.has(k)) zIndex.set(k, []);
    zIndex.get(k).push(n);
  }
}
console.log("\nTROTTA SRL keys", trottaKeys);
for (const k of trottaKeys) {
  console.log("  z match", k, zIndex.get(k)?.slice(0, 5));
}

const leonardoKeys = nameKeys("FINESTRE LEONARDO Srl 1845");
console.log("\nLEONARDO keys", leonardoKeys);
for (const k of leonardoKeys) {
  console.log("  z match", k, zIndex.get(k)?.slice(0, 5));
}
const pIndex = new Map();
for (const n of pNames) {
  for (const k of nameKeys(n)) {
    if (!pIndex.has(k)) pIndex.set(k, []);
    pIndex.get(k).push(n);
  }
}
for (const k of leonardoKeys) {
  console.log("  p match", k, pIndex.get(k)?.slice(0, 5));
}

// How did repair miss linking Z to TROTTA SRL (eterya)?
// Probably matched only to TROTTA SRL 13408
const { data: allTrotta } = await sb
  .from("companies")
  .select("id,name")
  .ilike("name", "%TROTTA%");
console.log("\nMatch simulation for each TROTTA company vs Z excel:");
for (const c of allTrotta ?? []) {
  const keys = nameKeys(c.name);
  const hits = keys.flatMap((k) => zIndex.get(k) ?? []);
  console.log(c.name, "->", [...new Set(hits)].slice(0, 5));
}
