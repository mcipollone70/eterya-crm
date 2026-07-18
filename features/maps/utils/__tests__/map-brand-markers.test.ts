/**
 * Test visualizzazione Brand su marker mappa.
 * Esegui: npx --yes tsx --test features/maps/utils/__tests__/map-brand-markers.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MapCompany, MapCompanyBrand } from "../../types/map";
import {
  buildBrandMarkerIconHtml,
  buildMapCompanyPopupHtml,
  buildNeutralMarkerIconHtml,
  companyMatchesMapCommercialStatusFilter,
  resolveBrandMarkerIconMetrics,
  resolveMapBrandInitial,
  resolveMapBrandMarkerVisual,
  resolveMapCompanyPrimaryRelationship,
  resolveMapCompanyRelationshipLabel,
  resolveMapCompanyStatusMarkerColor,
  sortMapCompanyBrands,
} from "../map-brand-markers";
import { filterMapCompanies } from "../map-filters";
import { DEFAULT_MAP_FILTERS } from "../../types/map";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "../../constants/map-config";

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

const ZANZAR = brand({
  slug: "zanzar",
  name: "ZANZAR",
  color: "#1E8449",
  relationship_status: "customer",
});
const PALAGINA = brand({
  slug: "palagina",
  name: "PALAGINA",
  color: "#B9770E",
  relationship_status: "prospect",
});
const ETERYA = brand({
  slug: "eterya",
  name: "ETERYA",
  color: "#1B4F72",
  is_primary: true,
  relationship_status: "customer",
});
const TEMPRA = brand({
  slug: "tempra-glass",
  name: "TEMPRA GLASS",
  color: "#6C3483",
  relationship_status: "former_customer",
});

function company(overrides: Partial<MapCompany> = {}): MapCompany {
  return {
    id: "c1",
    name: "ACME SRL",
    address: "Via Roma 1",
    phone: null,
    city: "Latina",
    province: "LT",
    commercial_status: "prospect",
    geocode_status: "geocoded",
    latitude: 41.46,
    longitude: 12.9,
    brands: [],
    ...overrides,
  };
}

describe("map brand initials", () => {
  it("mappa slug → Z P E T", () => {
    assert.equal(resolveMapBrandInitial(ZANZAR), "Z");
    assert.equal(resolveMapBrandInitial(PALAGINA), "P");
    assert.equal(resolveMapBrandInitial(ETERYA), "E");
    assert.equal(resolveMapBrandInitial(TEMPRA), "T");
  });

  it("slug/name case-insensitive e varianti spazi/underscore", () => {
    assert.equal(resolveMapBrandInitial(brand({ slug: "ZANZAR", name: "x" })), "Z");
    assert.equal(resolveMapBrandInitial(brand({ slug: "Palagina", name: "x" })), "P");
    assert.equal(
      resolveMapBrandInitial(brand({ slug: "tempra_glass", name: "x" })),
      "T"
    );
    assert.equal(
      resolveMapBrandInitial(brand({ slug: "unknown", name: "TEMPRA GLASS" })),
      "T"
    );
    assert.equal(
      resolveMapBrandInitial(brand({ slug: "unknown", name: "ZANZAR" })),
      "Z"
    );
  });

  it("ZANZAR non-primary produce comunque Z sul marker", () => {
    const visual = resolveMapBrandMarkerVisual([
      brand({ ...ZANZAR, is_primary: false }),
    ]);
    assert.equal(visual.initials, "Z");
  });

  it("1 Brand → una lettera, colore brand", () => {
    const visual = resolveMapBrandMarkerVisual([ZANZAR]);
    assert.equal(visual.initials, "Z");
    assert.equal(visual.showCrown, false);
    assert.equal(visual.color, "#1E8449");
  });

  it("2 Brand → lettere affiancate, primary first", () => {
    const visual = resolveMapBrandMarkerVisual([ZANZAR, ETERYA]);
    assert.equal(visual.initials, "EZ");
    assert.equal(visual.showCrown, false);
    assert.equal(visual.color, "#1B4F72");
  });

  it("3 Brand → tre iniziali, primary first poi alfabetico", () => {
    const visual = resolveMapBrandMarkerVisual([TEMPRA, ZANZAR, ETERYA]);
    assert.equal(visual.initials, "ETZ");
    assert.equal(visual.showCrown, false);
  });

  it("3 Brand → iconSize largo abbastanza (no clip terza lettera)", () => {
    const visual = resolveMapBrandMarkerVisual([
      brand({ ...ETERYA, is_primary: true }),
      brand({ ...PALAGINA, is_primary: false }),
      brand({ ...ZANZAR, is_primary: false }),
    ]);
    assert.equal(visual.initials, "EPZ");
    const metrics = resolveBrandMarkerIconMetrics(visual.initials, visual.showCrown);
    assert.equal(metrics.width, 62);
    assert.deepEqual(metrics.iconSize, [62, 32]);
    assert.deepEqual(metrics.iconAnchor, [31, 16]);
    const html = buildBrandMarkerIconHtml(visual, "#16a34a");
    assert.match(html, /width:62px/);
    assert.match(html, />E<\/span>/);
    assert.match(html, />P<\/span>/);
    assert.match(html, />Z<\/span>/);
    assert.equal((html.match(/<span style="display:inline-flex/g) ?? []).length, 3);
    assert.doesNotMatch(html, /slice\(0,\s*2\)/);
  });

  it("1/2/4 Brand → metriche coerenti", () => {
    assert.deepEqual(resolveBrandMarkerIconMetrics("E", false).iconSize, [32, 32]);
    assert.deepEqual(resolveBrandMarkerIconMetrics("EZ", false).iconSize, [44, 32]);
    assert.deepEqual(resolveBrandMarkerIconMetrics("EPTZ", true).iconSize, [76, 48]);
    assert.deepEqual(resolveBrandMarkerIconMetrics("EPTZ", true).iconAnchor, [38, 24]);
  });

  it("4 Brand → iniziali + corona, colore primary", () => {
    const visual = resolveMapBrandMarkerVisual([TEMPRA, ZANZAR, PALAGINA, ETERYA]);
    assert.equal(visual.initials, "EPTZ");
    assert.equal(visual.showCrown, true);
    assert.equal(visual.color, "#1B4F72");
  });

  it("nessun Brand → marker neutro", () => {
    const visual = resolveMapBrandMarkerVisual([]);
    assert.equal(visual.initials, "");
    assert.equal(visual.showCrown, false);
    assert.equal(visual.color, null);
  });

  it("senza primary → colore del primo alfabetico", () => {
    const visual = resolveMapBrandMarkerVisual([
      brand({ ...ZANZAR, is_primary: false }),
      brand({ ...PALAGINA, is_primary: false }),
    ]);
    assert.equal(visual.initials, "PZ");
    assert.equal(visual.color, "#B9770E");
  });
});

describe("map brand sort order", () => {
  it("primary prima, poi alfabetico", () => {
    const ordered = sortMapCompanyBrands([TEMPRA, ZANZAR, ETERYA, PALAGINA]);
    assert.deepEqual(
      ordered.map((b) => b.slug),
      ["eterya", "palagina", "tempra-glass", "zanzar"]
    );
  });
});

describe("map company popup", () => {
  it("mostra nome, brand, relazione, primario e link scheda", () => {
    const html = buildMapCompanyPopupHtml(
      company({
        brands: [
          brand({ ...ETERYA, is_primary: true }),
          brand({ ...ZANZAR, is_primary: false }),
        ],
      })
    );
    assert.match(html, /ACME SRL/);
    assert.match(html, /ETERYA/);
    assert.match(html, /ZANZAR/);
    assert.match(html, /Principale/);
    assert.match(html, /Cliente/);
    assert.match(html, /\/companies\/c1/);
  });

  it("senza brand mostra relazione da commercial_status", () => {
    const html = buildMapCompanyPopupHtml(
      company({ commercial_status: "cliente", brands: [] })
    );
    assert.match(html, /Nessun marchio associato/);
    assert.match(html, /Cliente/);
  });
});

describe("regression: stato Cliente/Prospect coerente marker+popup", () => {
  it("Cliente ETERYA con legacy commercial_status prospect → appare Cliente", () => {
    const c = company({
      commercial_status: "prospect",
      brands: [brand({ ...ETERYA, relationship_status: "customer", is_primary: true })],
    });
    assert.equal(resolveMapCompanyPrimaryRelationship(c), "customer");
    assert.equal(resolveMapCompanyRelationshipLabel(c), "Cliente");
    assert.equal(
      resolveMapCompanyStatusMarkerColor(c),
      COMMERCIAL_STATUS_MARKER_COLORS.cliente
    );
    const html = buildMapCompanyPopupHtml(c);
    assert.match(html, /data-map-status="cliente"/);
    assert.match(html, /Cliente/);
    assert.equal(companyMatchesMapCommercialStatusFilter(c, "cliente"), true);
    assert.equal(companyMatchesMapCommercialStatusFilter(c, "prospect"), false);
  });

  it("ETERYA+ZANZAR → EZ (primary first), popup elenca entrambi", () => {
    const c = company({
      brands: [
        brand({ ...ETERYA, is_primary: true, relationship_status: "customer" }),
        brand({ ...ZANZAR, is_primary: false, relationship_status: "customer" }),
      ],
    });
    const visual = resolveMapBrandMarkerVisual(c.brands);
    assert.equal(visual.initials, "EZ");
    const html = buildMapCompanyPopupHtml(c);
    assert.match(html, /data-brand-slug="eterya"/);
    assert.match(html, /data-brand-slug="zanzar"/);
  });

  it("TROTTA con ETERYA+ZANZAR → almeno E e Z", () => {
    const trotta = company({
      id: "52b73ac2-c71e-4996-b02c-b708080aea94",
      name: "TROTTA SRL",
      commercial_status: "cliente",
      brands: [
        brand({ ...ETERYA, is_primary: true, relationship_status: "customer" }),
        brand({ ...ZANZAR, is_primary: false, relationship_status: "customer" }),
      ],
    });
    const visual = resolveMapBrandMarkerVisual(trotta.brands);
    assert.match(visual.initials, /E/);
    assert.match(visual.initials, /Z/);
    assert.equal(visual.initials, "EZ");
    const html = buildMapCompanyPopupHtml(trotta);
    assert.match(html, /ETERYA/);
    assert.match(html, /ZANZAR/);
  });

  it("FINESTRE LEONARDO con E+P+Z → EPZ non tronca", () => {
    const leonardo = company({
      id: "a30d6c38-60bc-48e7-9de4-805b09e6f186",
      name: "FINESTRE LEONARDO Srl 1845",
      commercial_status: "cliente",
      brands: [
        brand({ ...ETERYA, is_primary: true, relationship_status: "customer" }),
        brand({ ...PALAGINA, is_primary: false, relationship_status: "customer" }),
        brand({ ...ZANZAR, is_primary: false, relationship_status: "customer" }),
      ],
    });
    const visual = resolveMapBrandMarkerVisual(leonardo.brands);
    assert.equal(visual.initials, "EPZ");
    assert.equal(visual.showCrown, false);
    const metrics = resolveBrandMarkerIconMetrics(visual.initials, false);
    assert.ok(metrics.width >= 60, "icon width must fit 3 letters");
    const markerHtml = buildBrandMarkerIconHtml(visual, "#16a34a");
    assert.match(markerHtml, />E<\/span>/);
    assert.match(markerHtml, />P<\/span>/);
    assert.match(markerHtml, />Z<\/span>/);
    const html = buildMapCompanyPopupHtml(leonardo);
    assert.match(html, /ETERYA/);
    assert.match(html, /PALAGINA/);
    assert.match(html, /ZANZAR/);
  });

  it("senza Brand + coords → resta in lista filtrata (COMEL)", () => {
    const companies = [
      company({
        id: "comel",
        name: "comel srl in liquidazione",
        brands: [],
        geocode_status: "completed",
        latitude: 41.590639,
        longitude: 12.829048,
      }),
      company({
        id: "with-brand",
        brands: [ETERYA],
        geocode_status: "completed",
      }),
    ];
    const filtered = filterMapCompanies(companies, DEFAULT_MAP_FILTERS);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some((c) => c.id === "comel" && (c.brands?.length ?? 0) === 0));
  });

  it("filtri Cliente/Prospect usano relationship_status; legacy solo senza Brand", () => {
    const companies = [
      company({
        id: "brand-customer-legacy-prospect",
        commercial_status: "prospect",
        brands: [brand({ ...ETERYA, relationship_status: "customer" })],
      }),
      company({
        id: "brand-prospect-legacy-cliente",
        commercial_status: "cliente",
        brands: [brand({ ...PALAGINA, relationship_status: "prospect" })],
      }),
      company({
        id: "no-brand-cliente",
        commercial_status: "cliente",
        brands: [],
      }),
      company({
        id: "no-brand-prospect",
        commercial_status: "prospect",
        brands: [],
      }),
    ];

    const clienti = filterMapCompanies(companies, {
      ...DEFAULT_MAP_FILTERS,
      commercialStatus: "cliente",
    });
    assert.deepEqual(
      clienti.map((c) => c.id).sort(),
      ["brand-customer-legacy-prospect", "no-brand-cliente"]
    );

    const prospects = filterMapCompanies(companies, {
      ...DEFAULT_MAP_FILTERS,
      commercialStatus: "prospect",
    });
    assert.deepEqual(
      prospects.map((c) => c.id).sort(),
      ["brand-prospect-legacy-cliente", "no-brand-prospect"]
    );
  });

  it("marker e popup usano la stessa relazione primaria", () => {
    const c = company({
      commercial_status: "prospect",
      brands: [
        brand({ ...ETERYA, is_primary: true, relationship_status: "customer" }),
        brand({ ...ZANZAR, is_primary: false, relationship_status: "prospect" }),
      ],
    });
    assert.equal(resolveMapCompanyRelationshipLabel(c), "Cliente");
    assert.equal(
      resolveMapCompanyStatusMarkerColor(c),
      COMMERCIAL_STATUS_MARKER_COLORS.cliente
    );
    assert.match(buildMapCompanyPopupHtml(c), /data-map-status="cliente"/);
  });
});

describe("neutral marker html", () => {
  it("genera cerchio senza lettera per aziende senza Brand", () => {
    const html = buildNeutralMarkerIconHtml("#2563eb");
    assert.match(html, /#2563eb/);
    assert.equal(/[ZPET]/.test(html), false);
  });
});
