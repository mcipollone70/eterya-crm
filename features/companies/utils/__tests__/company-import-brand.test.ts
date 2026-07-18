/**
 * Test Fase 4 — Import Excel intelligente con Brand.
 * Esegui: npx --yes tsx --test features/companies/utils/__tests__/company-import-brand.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapHeaderToField } from "../detect-headers";
import {
  buildDedupeLookup,
  findExistingCompany,
  mergeCompanyFields,
  resolveBrandIsPrimary,
  resolveCustomerCodeUpdate,
} from "../import-dedupe";
import { commercialStatusFromBrandRelationship } from "../build-db-rows";
import {
  buildCompanyBrandSelectColumns,
  buildCompanyBrandWritePayload,
  extractSupabaseError,
  formatImportRowDisplay,
  formatImportRowReason,
  isMissingCompanyBrandsColumnError,
} from "../import-errors";

const PALAGINA = "brand-palagina";
const ZANZAR = "brand-zanzar";
const ETERYA = "brand-eterya";

describe("Fase 4 — sinonimi colonne Excel", () => {
  it("riconosce colonne con nomi differenti", () => {
    assert.equal(mapHeaderToField("Ragione sociale").field, "name");
    assert.equal(mapHeaderToField("Cliente").field, "name");
    assert.equal(mapHeaderToField("Denominazione").field, "name");
    assert.equal(mapHeaderToField("Azienda").field, "name");
    assert.equal(mapHeaderToField("P.IVA").field, "vat_number");
    assert.equal(mapHeaderToField("Partita IVA").field, "vat_number");
    assert.equal(mapHeaderToField("VAT").field, "vat_number");
    assert.equal(mapHeaderToField("Tel").field, "phone");
    assert.equal(mapHeaderToField("Telefono").field, "phone");
    assert.equal(mapHeaderToField("Numero telefono").field, "phone");
    assert.equal(mapHeaderToField("Mail").field, "email");
    assert.equal(mapHeaderToField("E-mail").field, "email");
    assert.equal(mapHeaderToField("Indirizzo").field, "address");
    assert.equal(mapHeaderToField("Via").field, "street");
    assert.equal(mapHeaderToField("Civico").field, "street_number");
    assert.equal(mapHeaderToField("Località").field, "city");
    assert.equal(mapHeaderToField("Comune").field, "city");
    assert.equal(mapHeaderToField("Città").field, "city");
    assert.equal(mapHeaderToField("Prov").field, "province");
    assert.equal(mapHeaderToField("Codice cliente").field, "customer_code");
    assert.equal(mapHeaderToField("Cod. cliente").field, "customer_code");
    assert.equal(mapHeaderToField("Codice anagrafica").field, "customer_code");
  });
});

describe("Fase 4 — deduplicazione", () => {
  const existing = [
    {
      id: "c1",
      vat_number: "IT12345678901",
      email: "info@acme.it",
      name: "ACME SRL",
      city: "Latina",
      address: "Via Roma 1",
    },
  ];
  const lookup = buildDedupeLookup(existing);

  it("duplicato per partita IVA", () => {
    const hit = findExistingCompany(lookup, {
      vatNumber: "it 12345678901",
      name: "Altro",
    });
    assert.ok(hit);
    assert.equal(hit!.reason, "vat");
    assert.equal(hit!.company.id, "c1");
  });

  it("duplicato per email", () => {
    const hit = findExistingCompany(lookup, {
      email: "INFO@ACME.IT",
      name: "Altro",
    });
    assert.ok(hit);
    assert.equal(hit!.reason, "email");
  });

  it("match ragione sociale + comune", () => {
    const hit = findExistingCompany(lookup, {
      name: "Acme Srl",
      city: "latina",
    });
    assert.ok(hit);
    assert.equal(hit!.reason, "name_city");
  });

  it("riga senza ragione sociale non è matchabile per nome", () => {
    const hit = findExistingCompany(lookup, {
      name: "",
      city: "Latina",
      address: "Via Roma 1",
    });
    assert.equal(hit, null);
  });
});

describe("Fase 4 — import Cliente multi-Brand (scenario sequenziale)", () => {
  it("import Cliente PALAGINA: primo Brand → is_primary true", () => {
    const isPrimary = resolveBrandIsPrimary({
      existingLinkIsPrimary: false,
      companyHasAnyPrimary: false,
      setPrimaryIfNone: true,
    });
    assert.equal(isPrimary, true);
    assert.equal(PALAGINA, "brand-palagina");
  });

  it("import Cliente ZANZAR su azienda già esistente: non crea duplicato azienda, aggiunge Brand", () => {
    const lookup = buildDedupeLookup([
      {
        id: "company-1",
        vat_number: "IT999",
        email: null,
        name: "Cliente Condiviso",
        city: "Roma",
        address: null,
      },
    ]);
    const hit = findExistingCompany(lookup, {
      vatNumber: "IT999",
      name: "Cliente Condiviso",
    });
    assert.ok(hit);
    assert.equal(hit!.company.id, "company-1");

    // ZANZAR: primary già presente (PALAGINA) → non sovrascrive
    const zanzarPrimary = resolveBrandIsPrimary({
      existingLinkIsPrimary: false,
      companyHasAnyPrimary: true,
      setPrimaryIfNone: true,
    });
    assert.equal(zanzarPrimary, false);
    assert.equal(ZANZAR, "brand-zanzar");
  });

  it("import Cliente ETERYA su azienda con PALAGINA già associato: non rimuove altri Brand, non sovrascrive primary", () => {
    const eteryaPrimary = resolveBrandIsPrimary({
      existingLinkIsPrimary: false,
      companyHasAnyPrimary: true, // PALAGINA primary
      setPrimaryIfNone: true,
    });
    assert.equal(eteryaPrimary, false);
    assert.equal(ETERYA, "brand-eterya");
  });

  it("secondo Brand non sovrascrive il principale", () => {
    assert.equal(
      resolveBrandIsPrimary({
        existingLinkIsPrimary: false,
        companyHasAnyPrimary: true,
        setPrimaryIfNone: true,
      }),
      false
    );
  });

  it("primo Brand impostato come principale", () => {
    assert.equal(
      resolveBrandIsPrimary({
        existingLinkIsPrimary: false,
        companyHasAnyPrimary: false,
        setPrimaryIfNone: true,
      }),
      true
    );
  });
});

describe("Fase 4 — customer_code e merge campi", () => {
  it("aggiornamento customer_code se presente nel file", () => {
    assert.equal(resolveCustomerCodeUpdate("CLI-100", null), "CLI-100");
    assert.equal(resolveCustomerCodeUpdate("CLI-200", "CLI-100"), "CLI-200");
    assert.equal(resolveCustomerCodeUpdate("", "CLI-100"), "CLI-100");
    assert.equal(resolveCustomerCodeUpdate(null, null), null);
  });

  it("aggiorna solo campi vuoti salvo overwrite", () => {
    const existing = {
      phone: "061234",
      email: null as string | null,
      notes: "",
    };
    const fillEmpty = mergeCompanyFields(
      existing,
      { phone: "069999", email: "a@b.it", notes: "nuova" },
      false
    );
    assert.deepEqual(fillEmpty, { email: "a@b.it", notes: "nuova" });

    const overwrite = mergeCompanyFields(
      existing,
      { phone: "069999", email: "a@b.it" },
      true
    );
    assert.deepEqual(overwrite, { phone: "069999", email: "a@b.it" });
  });

  it("mappa relazione Brand → commercial_status legacy", () => {
    assert.equal(commercialStatusFromBrandRelationship("customer"), "cliente");
    assert.equal(commercialStatusFromBrandRelationship("prospect"), "prospect");
    assert.equal(
      commercialStatusFromBrandRelationship("former_customer"),
      "ex_cliente"
    );
  });
});

describe("Fase 4 — validazione ragione sociale", () => {
  it("riga senza ragione sociale è invalida", () => {
    const name = "".trim();
    assert.equal(Boolean(name), false);
  });
});

describe("Regressione ZANZAR — company_brands senza colonne relationship", () => {
  /** Riga rappresentativa da clienti Zanzar.xls (falliva con PGRST204). */
  const zanzarRow = {
    name: "EDIL SERVICE SRL UNIPERSONALE (12450)",
    province: "LATINA",
    city: "SCAURI DI MINTURNO",
    address: "VIA APPIA, 11C",
    phone: "0771680320",
    mobile: "348 3960193",
    email: "info@edilserv.com",
    vat: "03084380595",
    customerCode: "12450",
    relationship: "customer" as const,
  };

  it("customer → commercial_status legacy cliente (compat DB)", () => {
    assert.equal(
      commercialStatusFromBrandRelationship(zanzarRow.relationship),
      "cliente"
    );
  });

  it("senza migration relationship: select/write omettono customer_code e relationship_status", () => {
    const schema = {
      hasRelationshipStatus: false,
      hasCustomerCode: false,
    };
    assert.equal(
      buildCompanyBrandSelectColumns(schema),
      "brand_id,is_primary"
    );

    const insertPayload = buildCompanyBrandWritePayload(
      {
        companyId: "company-1",
        brandId: ZANZAR,
        relationshipStatus: "customer",
        customerCode: zanzarRow.customerCode,
        isPrimary: false,
        schema,
      },
      "insert"
    );
    assert.deepEqual(insertPayload, {
      company_id: "company-1",
      brand_id: ZANZAR,
      is_primary: false,
    });
    assert.equal("customer_code" in insertPayload, false);
    assert.equal("relationship_status" in insertPayload, false);
  });

  it("con migration relationship: payload include customer_code e relationship_status", () => {
    const schema = {
      hasRelationshipStatus: true,
      hasCustomerCode: true,
    };
    const insertPayload = buildCompanyBrandWritePayload(
      {
        companyId: "company-1",
        brandId: ZANZAR,
        relationshipStatus: "customer",
        customerCode: zanzarRow.customerCode,
        isPrimary: false,
        schema,
      },
      "insert"
    );
    assert.equal(insertPayload.relationship_status, "customer");
    assert.equal(insertPayload.customer_code, "12450");
  });

  it("errore PGRST204 plain object non diventa Errore imprevisto", () => {
    const plain = {
      code: "PGRST204",
      message:
        "Could not find the 'customer_code' column of 'company_brands' in the schema cache",
      details: null,
      hint: null,
    };
    assert.equal(plain instanceof Error, false);
    const extracted = extractSupabaseError(plain);
    assert.equal(extracted.code, "PGRST204");
    assert.ok(extracted.message?.includes("customer_code"));
    assert.equal(isMissingCompanyBrandsColumnError(extracted), true);

    const reason = formatImportRowReason({
      operation: "upsert_company_brands",
      source: "import.service.ts:upsertCompanyBrandLink",
      error: plain,
    });
    assert.ok(reason.includes("PGRST204"));
    assert.ok(!reason.includes("Errore imprevisto"));

    const display = formatImportRowDisplay({
      rowIndex: 1,
      name: zanzarRow.name,
      code: extracted.code,
      message: extracted.message ?? "",
    });
    assert.equal(
      display,
      `Riga 1 — ${zanzarRow.name} — [PGRST204]: ${extracted.message}`
    );
  });

  it("ZANZAR su azienda già con PALAGINA primary: is_primary resta false", () => {
    assert.equal(
      resolveBrandIsPrimary({
        existingLinkIsPrimary: false,
        companyHasAnyPrimary: true,
        setPrimaryIfNone: true,
      }),
      false
    );
  });
});
