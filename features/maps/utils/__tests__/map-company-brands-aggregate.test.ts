/**
 * Test aggregazione / twin merge Brand mappa.
 * Esegui: npx --yes tsx --test features/maps/utils/__tests__/map-company-brands-aggregate.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MapCompany, MapCompanyBrand } from "../../types/map";
import { resolveMapBrandMarkerVisual } from "../map-brand-markers";
import {
  accumulateStablePagedRows,
  aggregateMapCompanyBrands,
  coreMapCompanyName,
  dedupeMapCompanyBrands,
  MAP_COMPANY_BRANDS_PAGE_SIZE,
  mergePaginatedCompanyBrandBatches,
  mergeTwinMapCompanyBrands,
  twinGroupKeyForMapCompany,
  unionMapCompanyBrandCaches,
} from "../map-company-brands-aggregate";

function brand(
  partial: Partial<MapCompanyBrand> & Pick<MapCompanyBrand, "slug" | "name">
): MapCompanyBrand {
  return {
    brand_id: partial.brand_id ?? partial.slug,
    name: partial.name,
    slug: partial.slug,
    color: partial.color ?? "#111111",
    is_primary: partial.is_primary ?? false,
    relationship_status: partial.relationship_status ?? "prospect",
    customer_code: partial.customer_code ?? null,
  };
}

const Z = brand({
  brand_id: "z-id",
  slug: "zanzar",
  name: "ZANZAR",
  relationship_status: "customer",
});
const P = brand({
  brand_id: "p-id",
  slug: "palagina",
  name: "PALAGINA",
  relationship_status: "customer",
});
const E = brand({
  brand_id: "e-id",
  slug: "eterya",
  name: "ETERYA",
  is_primary: true,
  relationship_status: "customer",
});
const T = brand({
  brand_id: "t-id",
  slug: "tempra-glass",
  name: "TEMPRA GLASS",
  relationship_status: "customer",
});

function company(overrides: Partial<MapCompany> = {}): MapCompany {
  return {
    id: "c1",
    name: "ACME",
    address: null,
    phone: null,
    city: null,
    province: null,
    commercial_status: "cliente",
    geocode_status: "completed",
    latitude: 41.4,
    longitude: 12.9,
    brands: [],
    ...overrides,
  };
}

describe("coreMapCompanyName", () => {
  it("allinea TROTTA SRL e TROTTA SRL 13408", () => {
    assert.equal(coreMapCompanyName("TROTTA SRL"), "trotta");
    assert.equal(coreMapCompanyName("TROTTA SRL 13408"), "trotta");
    assert.equal(coreMapCompanyName("TROTTA SRL (13408)"), "trotta");
  });

  it("allinea s.r.l. punteggiato a SRL", () => {
    assert.equal(
      coreMapCompanyName("FERRAMENTA PAVAN s.r.l. 5113"),
      "ferramenta pavan"
    );
    assert.equal(coreMapCompanyName("FERRAMENTA PAVAN SRL"), "ferramenta pavan");
  });
});

describe("dedupe / aggregate", () => {
  it("1 brand resta 1", () => {
    assert.equal(aggregateMapCompanyBrands([E]).length, 1);
  });

  it("2 brand distinti restano 2", () => {
    const out = aggregateMapCompanyBrands([E], [Z]);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((b) => b.slug),
      ["eterya", "zanzar"]
    );
  });

  it("3 brand", () => {
    assert.equal(aggregateMapCompanyBrands([E, P, Z]).length, 3);
  });

  it("4 brand", () => {
    assert.equal(aggregateMapCompanyBrands([E, P, T, Z]).length, 4);
  });

  it("duplicati brand_id collassano; primary vince", () => {
    const dup = brand({ ...Z, is_primary: false });
    const primary = brand({ ...Z, is_primary: true });
    const out = dedupeMapCompanyBrands([
      dup,
      primary,
      brand({ ...E, is_primary: false }),
    ]);
    assert.equal(out.length, 2);
    assert.equal(out.find((b) => b.slug === "zanzar")?.is_primary, true);
  });

  it("merge twin con due primary → ne resta uno solo", () => {
    const out = dedupeMapCompanyBrands([
      brand({ ...E, is_primary: true }),
      brand({ ...Z, is_primary: true }),
    ]);
    assert.equal(out.filter((b) => b.is_primary).length, 1);
    assert.equal(out.find((b) => b.slug === "eterya")?.is_primary, true);
  });

  it("senza primary → alfabetico", () => {
    const out = aggregateMapCompanyBrands([
      brand({ ...Z, is_primary: false }),
      brand({ ...P, is_primary: false }),
    ]);
    assert.deepEqual(
      out.map((b) => b.slug),
      ["palagina", "zanzar"]
    );
  });
});

describe("mergeTwinMapCompanyBrands", () => {
  it("TROTTA twin E + Z → entrambi EZ", () => {
    const companies = [
      company({
        id: "52b73ac2-c71e-4996-b02c-b708080aea94",
        name: "TROTTA SRL",
        latitude: 41.40594,
        longitude: 12.96919,
        brands: [E],
      }),
      company({
        id: "3bd3e268-833d-4127-bbdd-411c13819017",
        name: "TROTTA SRL 13408",
        latitude: 41.40594,
        longitude: 12.96919,
        brands: [Z],
      }),
    ];
    const merged = mergeTwinMapCompanyBrands(companies);
    for (const row of merged) {
      const visual = resolveMapBrandMarkerVisual(row.brands);
      assert.equal(visual.initials, "EZ");
      assert.equal(row.brands?.length, 2);
    }
  });

  it("FINESTRE LEONARDO E+P+Z → EPZ", () => {
    const companies = [
      company({
        id: "a30d6c38-60bc-48e7-9de4-805b09e6f186",
        name: "FINESTRE LEONARDO Srl 1845",
        latitude: 41.60868,
        longitude: 12.76196,
        brands: [P, Z],
      }),
      company({
        id: "twin-e",
        name: "FINESTRE LEONARDO SRL",
        latitude: 41.60868,
        longitude: 12.76196,
        brands: [E],
      }),
    ];
    const merged = mergeTwinMapCompanyBrands(companies);
    const visual = resolveMapBrandMarkerVisual(merged[0].brands);
    assert.equal(visual.initials, "EPZ");
  });

  it("aziende diverse stesso punto geocode NON mergiano Brand", () => {
    const companies = [
      company({
        id: "a",
        name: "ALPHA SRL",
        latitude: 41.0,
        longitude: 12.0,
        brands: [E],
      }),
      company({
        id: "b",
        name: "BETA SRL",
        latitude: 41.0,
        longitude: 12.0,
        brands: [Z],
      }),
    ];
    const merged = mergeTwinMapCompanyBrands(companies);
    assert.equal(merged[0].brands?.length, 1);
    assert.equal(merged[1].brands?.length, 1);
  });

  it("off-page twin brands si uniscono anche con un solo membro in pagina", () => {
    const companies = [
      company({
        id: "trotta-page",
        name: "TROTTA SRL",
        latitude: 41.40594,
        longitude: 12.96919,
        brands: [E],
      }),
    ];
    const twinKey = twinGroupKeyForMapCompany(companies[0]);
    assert.ok(twinKey);
    const offPage = new Map([[twinKey!, [Z]]]);
    const merged = mergeTwinMapCompanyBrands(companies, offPage);
    assert.equal(merged[0].brands?.length, 2);
    assert.equal(resolveMapBrandMarkerVisual(merged[0].brands).initials, "EZ");
  });
});

describe("unionMapCompanyBrandCaches", () => {
  it("non perde Brand se payload successivo è più povero", () => {
    const richer = [E, Z];
    const thinner = [E];
    const out = unionMapCompanyBrandCaches(richer, thinner);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((b) => b.slug).sort(),
      ["eterya", "zanzar"]
    );
  });

  it("due aziende con brand condivisi: dedupe brand_id", () => {
    const out = unionMapCompanyBrandCaches([E, Z], [E, P]);
    assert.equal(out.length, 3);
  });
});

describe("accumulateStablePagedRows", () => {
  it("pageSize default 1000", () => {
    assert.equal(MAP_COMPANY_BRANDS_PAGE_SIZE, 1000);
  });

  async function fakeSource(total: number, failAtFrom?: number) {
    const all = Array.from({ length: total }, (_, i) => ({ id: i }));
    return async (from: number, to: number) => {
      if (failAtFrom != null && from === failAtFrom) {
        return { rows: [], error: "mid-page boom" };
      }
      return { rows: all.slice(from, to + 1), error: null };
    };
  }

  it("<1000: una sola pagina", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(500),
    });
    assert.equal(error, null);
    assert.equal(rows.length, 500);
    assert.equal(pageCount, 1);
  });

  it("esattamente 1000: due fetch (seconda vuota/corta)", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(1000),
    });
    assert.equal(error, null);
    assert.equal(rows.length, 1000);
    assert.equal(pageCount, 2);
  });

  it("1001: due pagine complete + stop", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(1001),
    });
    assert.equal(error, null);
    assert.equal(rows.length, 1001);
    assert.equal(pageCount, 2);
  });

  it("2000: tre fetch (2 piene + 1 vuota)", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(2000),
    });
    assert.equal(error, null);
    assert.equal(rows.length, 2000);
    assert.equal(pageCount, 3);
  });

  it(">2000", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(2500),
    });
    assert.equal(error, null);
    assert.equal(rows.length, 2500);
    assert.equal(pageCount, 3);
  });

  it("errore a metà: fail senza accumulo parziale", async () => {
    const { rows, error, pageCount } = await accumulateStablePagedRows({
      pageSize: 1000,
      fetchPage: await fakeSource(2500, 1000),
    });
    assert.equal(error, "mid-page boom");
    assert.equal(rows.length, 0);
    assert.equal(pageCount, 2);
  });

  it("ordine range stabile: from cresce di pageSize", async () => {
    const ranges: Array<[number, number]> = [];
    await accumulateStablePagedRows({
      pageSize: 100,
      fetchPage: async (from, to) => {
        ranges.push([from, to]);
        const remaining = 250 - from;
        const len = Math.max(0, Math.min(100, remaining));
        return {
          rows: Array.from({ length: len }, (_, i) => from + i),
          error: null,
        };
      },
    });
    assert.deepEqual(ranges, [
      [0, 99],
      [100, 199],
      [200, 299],
    ]);
  });
});

describe("mergePaginatedCompanyBrandBatches", () => {
  it("paginazione >1000 associazioni: merge multi-batch senza overwrite company_id", () => {
    const batch1 = Array.from({ length: 600 }, (_, i) => ({
      company_id: `c-${i % 50}`,
      brand: brand({
        brand_id: i % 2 === 0 ? "e-id" : "z-id",
        slug: i % 2 === 0 ? "eterya" : "zanzar",
        name: i % 2 === 0 ? "ETERYA" : "ZANZAR",
      }),
    }));
    const batch2 = Array.from({ length: 500 }, (_, i) => ({
      company_id: `c-${i % 50}`,
      brand: brand({
        brand_id: "p-id",
        slug: "palagina",
        name: "PALAGINA",
      }),
    }));
    const { byCompanyId, associationCount, countMatchesExpected } =
      mergePaginatedCompanyBrandBatches([batch1, batch2], 1100);
    assert.equal(associationCount, 1100);
    assert.equal(countMatchesExpected, true);
    assert.equal(byCompanyId.size, 50);
    for (const list of byCompanyId.values()) {
      assert.ok(list.length >= 1);
      assert.ok(list.length <= 3);
    }
  });

  it("1/2/3/4 brand restano completi dopo merge batch", () => {
    const { byCompanyId } = mergePaginatedCompanyBrandBatches([
      [
        { company_id: "one", brand: E },
        { company_id: "two", brand: E },
        { company_id: "two", brand: Z },
        { company_id: "three", brand: E },
        { company_id: "three", brand: P },
        { company_id: "three", brand: Z },
        { company_id: "four", brand: E },
        { company_id: "four", brand: P },
        { company_id: "four", brand: Z },
        { company_id: "four", brand: T },
      ],
    ]);
    assert.equal(byCompanyId.get("one")?.length, 1);
    assert.equal(byCompanyId.get("two")?.length, 2);
    assert.equal(byCompanyId.get("three")?.length, 3);
    assert.equal(byCompanyId.get("four")?.length, 4);
  });

  it("orfano brand (lista vuota) e azienda senza brand", () => {
    const { byCompanyId } = mergePaginatedCompanyBrandBatches([[]]);
    assert.equal(byCompanyId.size, 0);
    assert.equal(aggregateMapCompanyBrands([]).length, 0);
  });

  it("unknown slug resta nel payload (iniziale fallback)", () => {
    const unknown = brand({
      brand_id: "u1",
      slug: "altro-marchio",
      name: "Altro",
    });
    const out = aggregateMapCompanyBrands([E, unknown]);
    assert.equal(out.length, 2);
    assert.equal(resolveMapBrandMarkerVisual(out).initials, "EA");
  });

  it("Pavan ZP / Arca ZP / Trotta EZ / Leonardo EPZ", () => {
    const pavan = resolveMapBrandMarkerVisual([Z, P]);
    assert.equal(pavan.initials, "PZ");
    const arca = resolveMapBrandMarkerVisual([Z, P]);
    assert.equal(arca.initials, "PZ");
    const trotta = resolveMapBrandMarkerVisual([E, Z]);
    assert.equal(trotta.initials, "EZ");
    const leo = resolveMapBrandMarkerVisual([E, P, Z]);
    assert.equal(leo.initials, "EPZ");
  });

  it("global set equality expected===payload dopo twin merge", () => {
    const expected = new Set(["eterya", "zanzar", "palagina"]);
    const payload = mergeTwinMapCompanyBrands([
      company({
        id: "a",
        name: "FINESTRE LEONARDO SRL",
        latitude: 41.6,
        longitude: 12.7,
        brands: [E],
      }),
      company({
        id: "b",
        name: "FINESTRE LEONARDO Srl 1845",
        latitude: 41.6,
        longitude: 12.7,
        brands: [P, Z],
      }),
    ]);
    for (const row of payload) {
      const actual = new Set((row.brands ?? []).map((b) => b.slug));
      assert.deepEqual([...actual].sort(), [...expected].sort());
    }
  });
});
