import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyMatchesBrandFilters,
  companyMatchesBrandRelationshipFilter,
  companyMatchesBrandSlugs,
  normalizeBrandSlug,
  parseBrandMatchMode,
  parseBrandsUrlParam,
  resolveBrandInitial,
  serializeBrandsUrlParam,
  sortBrandAssociations,
  type BrandAssociationView,
} from "../brand-shared";

function brand(
  partial: Partial<BrandAssociationView> & Pick<BrandAssociationView, "slug" | "name">
): BrandAssociationView {
  return {
    brand_id: partial.brand_id ?? partial.slug,
    name: partial.name,
    slug: partial.slug,
    color: partial.color ?? null,
    is_primary: partial.is_primary ?? false,
    relationship_status: partial.relationship_status ?? "prospect",
    customer_code: partial.customer_code ?? null,
  };
}

const E = brand({
  slug: "eterya",
  name: "ETERYA",
  relationship_status: "customer",
  is_primary: true,
});
const Z = brand({
  slug: "zanzar",
  name: "ZANZAR",
  relationship_status: "prospect",
});
const P = brand({
  slug: "palagina",
  name: "PALAGINA",
  relationship_status: "customer",
});
const T = brand({
  slug: "tempra-glass",
  name: "TEMPRA GLASS",
  relationship_status: "former_customer",
});

describe("brand-shared normalize + URL", () => {
  it("normalizes slug variants", () => {
    assert.equal(normalizeBrandSlug(" Tempra Glass "), "tempra-glass");
    assert.equal(normalizeBrandSlug("TEMPRA_GLASS"), "tempra-glass");
  });

  it("parses and serializes brands URL param", () => {
    assert.deepEqual(parseBrandsUrlParam("eterya,zanzar"), ["eterya", "zanzar"]);
    assert.deepEqual(parseBrandsUrlParam("eterya,eterya,zanzar"), ["eterya", "zanzar"]);
    assert.equal(serializeBrandsUrlParam(["zanzar", "eterya"]), "zanzar,eterya");
    assert.equal(parseBrandMatchMode("and"), "and");
    assert.equal(parseBrandMatchMode(null), "or");
  });

  it("resolves official initials E/Z/P/T", () => {
    assert.equal(resolveBrandInitial(E), "E");
    assert.equal(resolveBrandInitial(Z), "Z");
    assert.equal(resolveBrandInitial(P), "P");
    assert.equal(resolveBrandInitial(T), "T");
  });
});

describe("brand-shared match OR/AND", () => {
  it("OR: almeno uno", () => {
    assert.equal(companyMatchesBrandSlugs([E, Z], ["eterya"], "or"), true);
    assert.equal(companyMatchesBrandSlugs([E, Z], ["palagina"], "or"), false);
    assert.equal(companyMatchesBrandSlugs([E, Z], ["eterya", "palagina"], "or"), true);
  });

  it("AND: tutti i selezionati", () => {
    assert.equal(companyMatchesBrandSlugs([E, Z], ["eterya", "zanzar"], "and"), true);
    assert.equal(companyMatchesBrandSlugs([E, Z], ["eterya", "palagina"], "and"), false);
  });

  it("1-4 brands sort primary first", () => {
    const ordered = sortBrandAssociations([Z, P, E, T]);
    assert.equal(ordered[0].slug, "eterya");
    // primary E, poi alfabetico: Palagina, Tempra Glass, Zanzar → EPTZ
    assert.equal(ordered.map((b) => resolveBrandInitial(b)).join(""), "EPTZ");
  });
});

describe("brand-shared + relationship_status", () => {
  it("Cliente ETERYA non matcha Cliente ZANZAR su status misto", () => {
    const mixed = [E, Z]; // E customer, Z prospect
    assert.equal(
      companyMatchesBrandRelationshipFilter(mixed, "cliente", ["eterya"]),
      true
    );
    assert.equal(
      companyMatchesBrandRelationshipFilter(mixed, "cliente", ["zanzar"]),
      false
    );
    assert.equal(
      companyMatchesBrandRelationshipFilter(mixed, "prospect", ["zanzar"]),
      true
    );
  });

  it("Brand + commercial combine", () => {
    assert.equal(
      companyMatchesBrandFilters({
        brands: [E, Z],
        selectedSlugs: ["eterya"],
        commercialStatus: "cliente",
      }),
      true
    );
    assert.equal(
      companyMatchesBrandFilters({
        brands: [E, Z],
        selectedSlugs: ["zanzar"],
        commercialStatus: "cliente",
      }),
      false
    );
    assert.equal(
      companyMatchesBrandFilters({
        brands: [E, Z],
        selectedSlugs: ["eterya", "zanzar"],
        matchMode: "and",
        commercialStatus: "cliente",
      }),
      false
    );
  });

  it("legacy fallback without brands", () => {
    assert.equal(
      companyMatchesBrandFilters({
        brands: [],
        selectedSlugs: [],
        commercialStatus: "cliente",
        legacyCommercialStatus: "cliente",
      }),
      true
    );
  });
});
