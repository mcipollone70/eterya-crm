/**
 * Formattazione errori import + payload company_brands schema-aware.
 * Funzioni pure — testabili senza Supabase.
 */

export type ImportFailedOperation =
  | "select"
  | "insert_company"
  | "update_company"
  | "upsert_company_brands"
  | "lookup";

export interface ImportSupabaseErrorShape {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface CompanyBrandsSchemaCapabilities {
  hasRelationshipStatus: boolean;
  hasCustomerCode: boolean;
}

export interface CompanyBrandWriteInput {
  companyId: string;
  brandId: string;
  relationshipStatus: string;
  customerCode: string | null;
  isPrimary: boolean;
  schema: CompanyBrandsSchemaCapabilities;
}

/** Duck-typing: PostgREST error può non essere instanceof Error (realm/bundler). */
export function extractSupabaseError(error: unknown): ImportSupabaseErrorShape {
  if (error == null) {
    return { message: "Errore sconosciuto" };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  if (typeof error !== "object") {
    return { message: String(error) };
  }
  const e = error as Record<string, unknown>;
  return {
    code: typeof e.code === "string" ? e.code : null,
    message:
      typeof e.message === "string" && e.message.trim()
        ? e.message
        : "Errore senza message",
    details: typeof e.details === "string" ? e.details : null,
    hint: typeof e.hint === "string" ? e.hint : null,
  };
}

export function isMissingCompanyBrandsColumnError(
  error: ImportSupabaseErrorShape
): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "PGRST204" ||
    code === "42703" ||
    /Could not find the '.*' column of 'company_brands'/i.test(message) ||
    /column company_brands\./i.test(message)
  );
}

/**
 * Colonne SELECT sicure su company_brands in base allo schema reale.
 * Evita 42703/PGRST204 su customer_code quando la migration relationship non è applicata.
 */
export function buildCompanyBrandSelectColumns(
  schema: CompanyBrandsSchemaCapabilities
): string {
  const cols = ["brand_id", "is_primary"];
  if (schema.hasCustomerCode) cols.push("customer_code");
  if (schema.hasRelationshipStatus) cols.push("relationship_status");
  return cols.join(",");
}

/** Payload insert/update senza colonne assenti dallo schema live. */
export function buildCompanyBrandWritePayload(
  input: CompanyBrandWriteInput,
  mode: "insert" | "update"
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    is_primary: input.isPrimary,
  };

  if (mode === "insert") {
    payload.company_id = input.companyId;
    payload.brand_id = input.brandId;
  }

  if (input.schema.hasRelationshipStatus) {
    payload.relationship_status = input.relationshipStatus;
  }
  if (input.schema.hasCustomerCode) {
    payload.customer_code = input.customerCode;
  }

  return payload;
}

export function formatImportRowReason(input: {
  operation: ImportFailedOperation;
  source: string;
  error: unknown;
}): string {
  const sb = extractSupabaseError(input.error);
  const parts = [
    `[${sb.code ?? "NO_CODE"}]`,
    sb.message ?? "Errore senza message",
  ];
  if (sb.details) parts.push(`details: ${sb.details}`);
  if (sb.hint) parts.push(`hint: ${sb.hint}`);
  parts.push(`op: ${input.operation}`);
  parts.push(`src: ${input.source}`);
  if (isMissingCompanyBrandsColumnError(sb)) {
    parts.push(
      "constraint/schema: applicare supabase/migrations/20260717_company_brands_relationship.sql"
    );
  }
  return parts.join(" | ");
}

/** Report UI: Riga X — Azienda — [codice]: messaggio */
export function formatImportRowDisplay(input: {
  rowIndex: number;
  name: string;
  code?: string | null;
  message: string;
}): string {
  const company = input.name?.trim() || "—";
  const code = input.code?.trim() || "NO_CODE";
  return `Riga ${input.rowIndex} — ${company} — [${code}]: ${input.message}`;
}
