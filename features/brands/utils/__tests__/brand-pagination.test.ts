import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accumulateStablePagedRows,
  aggregateMapCompanyBrands,
  dedupeMapCompanyBrands,
} from "../../../maps/utils/map-company-brands-aggregate";
import type { MapCompanyBrand } from "../../../maps/types/map";

function brand(
  partial: Partial<MapCompanyBrand> & Pick<MapCompanyBrand, "slug" | "name" | "brand_id">
): MapCompanyBrand {
  return {
    brand_id: partial.brand_id,
    name: partial.name,
    slug: partial.slug,
    color: partial.color ?? null,
    is_primary: partial.is_primary ?? false,
    relationship_status: partial.relationship_status ?? "prospect",
  };
}

describe("company_brands pagination merge >1000", () => {
  it("accumulateStablePagedRows concatenates pages without overwrite", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      company_id: `c-${String(i).padStart(4, "0")}`,
      brand_id: "b-e",
    }));
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      company_id: `c-${String(1000 + i).padStart(4, "0")}`,
      brand_id: "b-z",
    }));

    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: async (from) => {
        if (from === 0) return { rows: page1, error: null };
        if (from === 1000) return { rows: page2, error: null };
        return { rows: [], error: null };
      },
    });

    assert.equal(error, null);
    assert.equal(pageCount, 2);
    assert.equal(rows.length, 1050);
    assert.equal(rows[0].company_id, "c-0000");
    assert.equal(rows[1049].brand_id, "b-z");
  });

  it("aggregate does not lose multibrand on merge", () => {
    const a = [
      brand({ brand_id: "1", slug: "eterya", name: "ETERYA", is_primary: true }),
      brand({ brand_id: "2", slug: "zanzar", name: "ZANZAR" }),
    ];
    const b = [
      brand({ brand_id: "2", slug: "zanzar", name: "ZANZAR", is_primary: true }),
      brand({ brand_id: "3", slug: "palagina", name: "PALAGINA" }),
    ];
    const out = aggregateMapCompanyBrands(a, b);
    assert.equal(out.length, 3);
    assert.equal(out.filter((x) => x.is_primary).length, 1);
    const slugs = out.map((x) => x.slug).sort();
    assert.deepEqual(slugs, ["eterya", "palagina", "zanzar"]);
  });

  it("dedupe keeps one primary", () => {
    const out = dedupeMapCompanyBrands([
      brand({ brand_id: "1", slug: "eterya", name: "ETERYA", is_primary: true }),
      brand({ brand_id: "1", slug: "eterya", name: "ETERYA", is_primary: false }),
      brand({ brand_id: "2", slug: "zanzar", name: "ZANZAR", is_primary: true }),
    ]);
    assert.equal(out.length, 2);
    assert.equal(out.filter((x) => x.is_primary).length, 1);
  });
});
