/**
 * Import aziende + Brand — servizio server.
 * Schema-aware su company_brands: se la migration relationship non è applicata,
 * scrive solo colonne base (company_id, brand_id, is_primary) senza fallire.
 */
import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import type { BrandRelationshipStatus } from "@/lib/supabase/types";
import type { CompanyImportBrandOptions } from "../types/import";
import type { CompanyImportRowPayload, CompanyInsert } from "../utils/build-db-rows";
import {
  buildCompanyBrandSelectColumns,
  buildCompanyBrandWritePayload,
  extractSupabaseError,
  formatImportRowDisplay,
  formatImportRowReason,
  type CompanyBrandsSchemaCapabilities,
  type ImportFailedOperation,
} from "../utils/import-errors";
import {
  buildDedupeLookup,
  findExistingCompany,
  mergeCompanyFields,
  normalizeEmail,
  normalizeVat,
  resolveBrandIsPrimary,
  resolveCustomerCodeUpdate,
  type DedupeCandidate,
  type DedupeLookup,
} from "../utils/import-dedupe";
import {
  resolveAssignedUserIdForInsert,
  resolveAssignedUserIdForUpdate,
} from "../utils/import-assignment";

export interface ImportRowError {
  rowIndex: number;
  name: string;
  reason: string;
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  operation?: ImportFailedOperation;
  source?: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  brandLinksCreated: number;
  brandLinksUpdated: number;
  duplicatesAvoided: number;
  errors: string[];
  rowErrors: ImportRowError[];
}

export interface ImportCompanyRowsOptions {
  brand: CompanyImportBrandOptions;
}

const MAX_REPORTED_ERRORS = 100;
const LOOKUP_BATCH = 200;
const IMPORT_SOURCE = "import.service.ts";

type ExistingCompanyRow = DedupeCandidate & {
  assigned_user_id: string | null;
  tax_code: string | null;
  street: string | null;
  street_number: string | null;
  province: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  contact_name: string | null;
  contact_role: string | null;
  website: string | null;
  notes: string | null;
  commercial_status: string | null;
};

const COMPANY_SELECT =
  "id,assigned_user_id,vat_number,email,name,city,address,tax_code,street,street_number,province,region,postal_code,country,phone,mobile,contact_name,contact_role,website,notes,commercial_status";

function emptyResult(errors: string[]): ImportResult {
  return {
    success: false,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    brandLinksCreated: 0,
    brandLinksUpdated: 0,
    duplicatesAvoided: 0,
    errors,
    rowErrors: [],
  };
}

function pushRowError(
  result: ImportResult,
  input: {
    rowIndex: number;
    name: string;
    operation: ImportFailedOperation;
    source: string;
    error: unknown;
  }
): void {
  const sb = extractSupabaseError(input.error);
  const reason = formatImportRowReason({
    operation: input.operation,
    source: input.source,
    error: input.error,
  });
  const display = formatImportRowDisplay({
    rowIndex: input.rowIndex,
    name: input.name,
    code: sb.code,
    message: sb.message ?? reason,
  });

  result.rowErrors.push({
    rowIndex: input.rowIndex,
    name: input.name,
    reason,
    code: sb.code,
    message: sb.message,
    details: sb.details,
    hint: sb.hint,
    operation: input.operation,
    source: input.source,
  });
  if (result.errors.length < MAX_REPORTED_ERRORS) {
    result.errors.push(display);
  }
}

function refreshLookup(
  existingById: Map<string, ExistingCompanyRow>
): DedupeLookup {
  return buildDedupeLookup([...existingById.values()]);
}

async function detectCompanyBrandsSchema(): Promise<CompanyBrandsSchemaCapabilities> {
  const supabase = await createServerClient();

  const rel = await supabase
    .from("company_brands")
    .select("relationship_status")
    .limit(1);
  const code = await supabase
    .from("company_brands")
    .select("customer_code")
    .limit(1);

  return {
    hasRelationshipStatus: !rel.error,
    hasCustomerCode: !code.error,
  };
}

async function loadExistingCandidates(
  payloads: CompanyImportRowPayload[]
): Promise<ExistingCompanyRow[]> {
  const supabase = await createServerClient();
  const byId = new Map<string, ExistingCompanyRow>();

  const vats = [
    ...new Set(
      payloads.map((p) => normalizeVat(p.company.vat_number)).filter(Boolean)
    ),
  ];
  const emails = [
    ...new Set(
      payloads.map((p) => normalizeEmail(p.company.email)).filter(Boolean)
    ),
  ];

  for (let i = 0; i < vats.length; i += LOOKUP_BATCH) {
    const chunk = vats.slice(i, i + LOOKUP_BATCH);
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .in("vat_number", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      byId.set(row.id, row as ExistingCompanyRow);
    }
  }

  for (let i = 0; i < emails.length; i += LOOKUP_BATCH) {
    const chunk = emails.slice(i, i + LOOKUP_BATCH);
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .in("email", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      byId.set(row.id, row as ExistingCompanyRow);
    }
  }

  const cities = [
    ...new Set(
      payloads
        .map((p) => (p.company.city ?? "").trim())
        .filter((c) => c.length >= 2)
    ),
  ].slice(0, 80);

  for (const city of cities) {
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_SELECT)
      .ilike("city", city)
      .limit(500);
    if (error) throw error;
    for (const row of data ?? []) {
      byId.set(row.id, row as ExistingCompanyRow);
    }
  }

  return [...byId.values()];
}

async function upsertCompanyBrandLink(input: {
  companyId: string;
  brandId: string;
  relationshipStatus: BrandRelationshipStatus;
  customerCode: string | null;
  setPrimaryIfNone: boolean;
  schema: CompanyBrandsSchemaCapabilities;
}): Promise<"created" | "updated"> {
  const supabase = await createServerClient();
  const selectCols = buildCompanyBrandSelectColumns(input.schema);

  const existingRes = await supabase
    .from("company_brands")
    .select(selectCols)
    .eq("company_id", input.companyId)
    .eq("brand_id", input.brandId)
    .maybeSingle();

  if (existingRes.error) {
    throw Object.assign(existingRes.error, {
      __operation: "select" as const,
    });
  }

  const existing = existingRes.data as {
    brand_id?: string;
    is_primary?: boolean;
    customer_code?: string | null;
  } | null;

  const anyPrimaryRes = await supabase
    .from("company_brands")
    .select("brand_id")
    .eq("company_id", input.companyId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (anyPrimaryRes.error) {
    throw Object.assign(anyPrimaryRes.error, {
      __operation: "select" as const,
    });
  }

  const makePrimary = resolveBrandIsPrimary({
    existingLinkIsPrimary: Boolean(existing?.is_primary),
    companyHasAnyPrimary: Boolean(anyPrimaryRes.data),
    setPrimaryIfNone: input.setPrimaryIfNone,
  });

  const customerCode = resolveCustomerCodeUpdate(
    input.customerCode,
    existing?.customer_code ?? null
  );

  const writeInput = {
    companyId: input.companyId,
    brandId: input.brandId,
    relationshipStatus: input.relationshipStatus,
    customerCode,
    isPrimary: makePrimary,
    schema: input.schema,
  };

  if (existing) {
    const patch = buildCompanyBrandWritePayload(writeInput, "update") as {
      is_primary?: boolean;
      relationship_status?: BrandRelationshipStatus;
      customer_code?: string | null;
    };
    const { error } = await supabase
      .from("company_brands")
      .update(patch)
      .eq("company_id", input.companyId)
      .eq("brand_id", input.brandId);
    if (error) {
      throw Object.assign(error, { __operation: "upsert_company_brands" as const });
    }
    return "updated";
  }

  const row = buildCompanyBrandWritePayload(writeInput, "insert") as {
    company_id: string;
    brand_id: string;
    is_primary?: boolean;
    relationship_status?: BrandRelationshipStatus;
    customer_code?: string | null;
  };
  const { error } = await supabase.from("company_brands").insert(row);
  if (error) {
    throw Object.assign(error, { __operation: "upsert_company_brands" as const });
  }
  return "created";
}

function buildUpdatePatch(
  existing: ExistingCompanyRow,
  incoming: CompanyInsert,
  overwrite: boolean,
  currentUserId: string | null
): Partial<CompanyInsert> {
  const mergeable: Partial<CompanyInsert> = {
    vat_number: incoming.vat_number,
    tax_code: incoming.tax_code,
    address: incoming.address,
    street: incoming.street,
    street_number: incoming.street_number,
    city: incoming.city,
    province: incoming.province,
    region: incoming.region,
    postal_code: incoming.postal_code,
    country: incoming.country,
    email: incoming.email,
    phone: incoming.phone,
    mobile: incoming.mobile,
    contact_name: incoming.contact_name,
    contact_role: incoming.contact_role,
    website: incoming.website,
    notes: incoming.notes,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    geocode_status: incoming.geocode_status,
    geocoding_provider: incoming.geocoding_provider,
    geocoded_at: incoming.geocoded_at,
    geocoding_error: incoming.geocoding_error,
    geocoding_normalized_address: incoming.geocoding_normalized_address,
    import_source: incoming.import_source,
    import_file_name: incoming.import_file_name,
    import_row_index: incoming.import_row_index,
    import_headers: incoming.import_headers,
    import_payload: incoming.import_payload,
    import_column_count: incoming.import_column_count,
  };

  if (overwrite || !existing.commercial_status) {
    mergeable.commercial_status = incoming.commercial_status;
  }

  if (incoming.name?.trim() && (overwrite || !existing.name?.trim())) {
    mergeable.name = incoming.name;
  }

  const patch = mergeCompanyFields(
    existing as unknown as Record<string, unknown>,
    mergeable as Record<string, unknown>,
    overwrite
  ) as Partial<CompanyInsert>;

  return resolveAssignedUserIdForUpdate(
    { ...incoming, ...patch, name: patch.name ?? existing.name } as CompanyInsert,
    existing.assigned_user_id,
    currentUserId
  );
}

/**
 * Import aziende + associazione Brand.
 * Dedup: P.IVA → email → nome+comune → nome+indirizzo.
 * Aggiornamento campi: solo vuoti (salvo overwrite).
 * Non rimuove altri Brand già associati.
 */
export async function importCompanyRows(
  payloads: CompanyImportRowPayload[],
  options: ImportCompanyRowsOptions
): Promise<ImportResult> {
  if (payloads.length === 0) {
    return emptyResult(["Nessuna azienda da importare."]);
  }

  if (!options.brand?.brandId?.trim()) {
    return emptyResult(["Seleziona un Brand obbligatorio prima dell'import."]);
  }

  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  if (!currentUserId) {
    return emptyResult(["Devi essere autenticato per importare aziende."]);
  }

  const supabase = await createServerClient();
  const result: ImportResult = {
    success: false,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    brandLinksCreated: 0,
    brandLinksUpdated: 0,
    duplicatesAvoided: 0,
    errors: [],
    rowErrors: [],
  };

  let schema: CompanyBrandsSchemaCapabilities;
  try {
    schema = await detectCompanyBrandsSchema();
  } catch (error) {
    return emptyResult([
      formatImportRowReason({
        operation: "lookup",
        source: `${IMPORT_SOURCE}:detectCompanyBrandsSchema`,
        error,
      }),
    ]);
  }

  let existingRows: ExistingCompanyRow[];
  try {
    existingRows = await loadExistingCandidates(payloads);
  } catch (error) {
    return emptyResult([
      formatImportRowReason({
        operation: "lookup",
        source: `${IMPORT_SOURCE}:loadExistingCandidates`,
        error,
      }),
    ]);
  }

  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  let lookup = refreshLookup(existingById);

  for (const payload of payloads) {
    const row = payload.company;
    const name = (payload.recordName || row.name || "").trim();
    const rowIndex = payload.rowIndex;

    if (!name) {
      result.skippedCount++;
      pushRowError(result, {
        rowIndex,
        name,
        operation: "insert_company",
        source: `${IMPORT_SOURCE}:validateName`,
        error: { code: "VALIDATION", message: "Ragione sociale mancante" },
      });
      continue;
    }

    try {
      const match = findExistingCompany(lookup, {
        vatNumber: row.vat_number,
        email: row.email,
        name: row.name,
        city: row.city,
        address: row.address,
      });

      let companyId: string | null = null;
      let created = false;
      let updated = false;
      let duplicate = false;

      if (match) {
        duplicate = true;
        const existing =
          existingById.get(match.company.id) ??
          ({
            ...match.company,
            assigned_user_id: null,
            tax_code: null,
            street: null,
            street_number: null,
            province: null,
            region: null,
            postal_code: null,
            country: null,
            phone: null,
            mobile: null,
            contact_name: null,
            contact_role: null,
            website: null,
            notes: null,
            commercial_status: null,
          } satisfies ExistingCompanyRow);

        const updatePayload = buildUpdatePatch(
          existing,
          row,
          options.brand.overwriteExistingFields,
          currentUserId
        );

        const { error: updateError } = await supabase
          .from("companies")
          .update(updatePayload)
          .eq("id", match.company.id);

        if (updateError) {
          pushRowError(result, {
            rowIndex,
            name,
            operation: "update_company",
            source: `${IMPORT_SOURCE}:updateCompany`,
            error: updateError,
          });
          continue;
        }

        companyId = match.company.id;
        updated = true;
      } else {
        const insertPayload = resolveAssignedUserIdForInsert(row, currentUserId);
        const { data: inserted, error: insertError } = await supabase
          .from("companies")
          .insert(insertPayload)
          .select(COMPANY_SELECT)
          .maybeSingle();

        if (insertError?.code === "23505" && row.vat_number) {
          const { data: raced } = await supabase
            .from("companies")
            .select(COMPANY_SELECT)
            .eq("vat_number", normalizeVat(row.vat_number))
            .maybeSingle();

          if (!raced) {
            pushRowError(result, {
              rowIndex,
              name,
              operation: "insert_company",
              source: `${IMPORT_SOURCE}:insertCompany`,
              error: insertError,
            });
            continue;
          }

          const updatePayload = buildUpdatePatch(
            raced as ExistingCompanyRow,
            row,
            options.brand.overwriteExistingFields,
            currentUserId
          );
          const { error: updateError } = await supabase
            .from("companies")
            .update(updatePayload)
            .eq("id", raced.id);
          if (updateError) {
            pushRowError(result, {
              rowIndex,
              name,
              operation: "update_company",
              source: `${IMPORT_SOURCE}:updateAfterRace`,
              error: updateError,
            });
            continue;
          }

          companyId = raced.id;
          updated = true;
          duplicate = true;
          existingById.set(raced.id, raced as ExistingCompanyRow);
          lookup = refreshLookup(existingById);
        } else if (insertError) {
          pushRowError(result, {
            rowIndex,
            name,
            operation: "insert_company",
            source: `${IMPORT_SOURCE}:insertCompany`,
            error: insertError,
          });
          continue;
        } else if (!inserted?.id) {
          pushRowError(result, {
            rowIndex,
            name,
            operation: "insert_company",
            source: `${IMPORT_SOURCE}:insertCompany`,
            error: {
              code: "NO_ID",
              message: "Insert senza id restituito",
            },
          });
          continue;
        } else {
          companyId = inserted.id;
          created = true;
          existingById.set(inserted.id, inserted as ExistingCompanyRow);
          lookup = refreshLookup(existingById);
        }
      }

      if (!companyId) {
        pushRowError(result, {
          rowIndex,
          name,
          operation: "insert_company",
          source: `${IMPORT_SOURCE}:resolveCompanyId`,
          error: { code: "NO_COMPANY_ID", message: "Company id non risolto" },
        });
        continue;
      }

      try {
        const linkResult = await upsertCompanyBrandLink({
          companyId,
          brandId: options.brand.brandId,
          relationshipStatus: options.brand.relationshipStatus,
          customerCode: payload.customerCode,
          setPrimaryIfNone: options.brand.setPrimaryIfNone,
          schema,
        });

        if (created) result.importedCount++;
        if (updated) result.updatedCount++;
        if (duplicate) result.duplicatesAvoided++;
        if (linkResult === "created") result.brandLinksCreated++;
        else result.brandLinksUpdated++;
      } catch (linkError) {
        const op =
          linkError &&
          typeof linkError === "object" &&
          "__operation" in linkError &&
          (linkError as { __operation?: ImportFailedOperation }).__operation
            ? (linkError as { __operation: ImportFailedOperation }).__operation
            : "upsert_company_brands";
        pushRowError(result, {
          rowIndex,
          name,
          operation: op,
          source: `${IMPORT_SOURCE}:upsertCompanyBrandLink`,
          error: linkError,
        });
      }
    } catch (error) {
      pushRowError(result, {
        rowIndex,
        name,
        operation: "upsert_company_brands",
        source: `${IMPORT_SOURCE}:importCompanyRows`,
        error,
      });
    }
  }

  result.success =
    result.importedCount > 0 ||
    result.updatedCount > 0 ||
    result.brandLinksCreated > 0 ||
    result.brandLinksUpdated > 0;

  return result;
}
