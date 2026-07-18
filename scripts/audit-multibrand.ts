/**
 * Audit multibrand: DB company_brands vs coerenza slug ufficiali.
 * Esegui: npx tsx scripts/audit-multibrand.ts
 *
 * Report onesto: non inventa Brand assenti dal DB.
 */
import { createClient } from "@supabase/supabase-js";
import { normalizeBrandSlug, OFFICIAL_BRAND_SLUGS, resolveBrandInitial } from "../features/brands/utils/brand-shared";

const SAMPLE_NAMES = [
  "Pavan",
  "Trotta",
  "Leonardo",
  "Arca",
  "Ferramenta Pavan",
  "Finestre Leonardo",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / anon or service key");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id,name,slug,is_active");
  if (brandsError) {
    console.error("brands:", brandsError.message);
    process.exit(1);
  }

  const brandById = new Map((brands ?? []).map((b) => [b.id, b]));
  const unknownSlugs = new Set<string>();
  const officialSet = new Set(OFFICIAL_BRAND_SLUGS as readonly string[]);

  for (const b of brands ?? []) {
    const slug = normalizeBrandSlug(b.slug);
    if (!officialSet.has(slug)) {
      unknownSlugs.add(slug);
    }
  }

  // Paginate all company_brands
  const associations: Array<{
    company_id: string;
    brand_id: string;
    is_primary: boolean;
  }> = [];
  let offset = 0;
  const pageSize = 1000;
  let hasRelStatus = true;

  while (true) {
    let select = "company_id,brand_id,is_primary,relationship_status";
    let { data, error } = await supabase
      .from("company_brands")
      .select(select)
      .order("company_id", { ascending: true })
      .order("brand_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error && /relationship_status/i.test(error.message)) {
      hasRelStatus = false;
      select = "company_id,brand_id,is_primary";
      ({ data, error } = await supabase
        .from("company_brands")
        .select(select)
        .order("company_id", { ascending: true })
        .order("brand_id", { ascending: true })
        .range(offset, offset + pageSize - 1));
    }

    if (error) {
      console.error("company_brands:", error.message);
      process.exit(1);
    }

    const rows = data ?? [];
    associations.push(...((rows as unknown) as typeof associations));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const byCompany = new Map<string, typeof associations>();
  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  let multiPrimary = 0;

  for (const row of associations) {
    const key = `${row.company_id}|${row.brand_id}`;
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
    const list = byCompany.get(row.company_id) ?? [];
    list.push(row);
    byCompany.set(row.company_id, list);
  }

  for (const [, list] of byCompany) {
    if (list.filter((r) => r.is_primary).length > 1) multiPrimary += 1;
  }

  // Orphan brand_id
  let orphanBrandIds = 0;
  for (const row of associations) {
    if (!brandById.has(row.brand_id)) orphanBrandIds += 1;
  }

  // Company names for samples + totals
  const companyIds = Array.from(byCompany.keys());
  const companies: Array<{ id: string; name: string; commercial_status: string | null }> = [];
  for (let i = 0; i < companyIds.length; i += 200) {
    const chunk = companyIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,commercial_status")
      .in("id", chunk);
    if (error) {
      console.error("companies:", error.message);
      process.exit(1);
    }
    companies.push(...((data ?? []) as typeof companies));
  }

  const companyById = new Map(companies.map((c) => [c.id, c]));

  const { count: totalCompanies } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });

  console.log("=== AUDIT MULTIBRAND ===");
  console.log(`has_relationship_status_column: ${hasRelStatus}`);
  console.log(`brands_catalog: ${(brands ?? []).length}`);
  console.log(`unknown_slugs: ${[...unknownSlugs].join(", ") || "(none)"}`);
  console.log(`company_brands_rows: ${associations.length}`);
  console.log(`companies_with_brands: ${byCompany.size}`);
  console.log(`total_companies_db: ${totalCompanies ?? "?"}`);
  console.log(`duplicate_company_brand_keys: ${duplicateKeys.size}`);
  console.log(`companies_multi_primary: ${multiPrimary}`);
  console.log(`orphan_brand_ids: ${orphanBrandIds}`);

  console.log("\n=== SAMPLES ===");
  for (const sample of SAMPLE_NAMES) {
    const matches = companies.filter((c) =>
      c.name.toLowerCase().includes(sample.toLowerCase())
    );
    if (matches.length === 0) {
      console.log(`${sample}: NOT FOUND in companies with brands (may exist without brands)`);
      // also search all companies
      const { data } = await supabase
        .from("companies")
        .select("id,name,commercial_status")
        .ilike("name", `%${sample}%`)
        .limit(10);
      for (const c of data ?? []) {
        const assoc = byCompany.get(c.id) ?? [];
        const initials = assoc
          .map((a) => {
            const b = brandById.get(a.brand_id);
            return b ? resolveBrandInitial({ slug: b.slug, name: b.name }) : "?";
          })
          .join("");
        const slugs = assoc
          .map((a) => brandById.get(a.brand_id)?.slug ?? "?")
          .join(",");
        console.log(
          `  - ${c.name} | commercial=${c.commercial_status} | brands=${slugs || "(none)"} | initials=${initials || "-"}`
        );
      }
      continue;
    }
    for (const c of matches) {
      const assoc = byCompany.get(c.id) ?? [];
      const slugs = assoc.map((a) => brandById.get(a.brand_id)?.slug ?? "?").join(",");
      const initials = assoc
        .map((a) => {
          const b = brandById.get(a.brand_id);
          return b ? resolveBrandInitial({ slug: b.slug, name: b.name }) : "?";
        })
        .join("");
      console.log(
        `${c.name} | commercial=${c.commercial_status} | brands=${slugs || "(none)"} | initials=${initials || "-"}`
      );
    }
  }

  // Truncated multibrand check: companies with 3+ brands
  const multi = [...byCompany.entries()].filter(([, list]) => list.length >= 3);
  console.log(`\ncompanies_with_3plus_brands: ${multi.length}`);
  for (const [id, list] of multi.slice(0, 15)) {
    const name = companyById.get(id)?.name ?? id;
    const initials = list
      .map((a) => {
        const b = brandById.get(a.brand_id);
        return b ? resolveBrandInitial({ slug: b.slug, name: b.name }) : "?";
      })
      .join("");
    console.log(`  ${name}: ${initials} (${list.length})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
