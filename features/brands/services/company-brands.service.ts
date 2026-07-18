import "server-only";

import { isBrandRelationshipStatus } from "@/lib/constants/brand-relationship";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import {
  buildCompanyBrandWritePayload,
  isMissingCompanyBrandsColumnError,
  type CompanyBrandsSchemaCapabilities,
} from "@/features/companies/utils/import-errors";
import type { BrandRelationshipStatus } from "@/lib/supabase/types";
import { commercialStatusToBrandRelationship } from "../utils/brand-shared";

export interface CompanyBrandItem {
  company_id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_short_code: string | null;
  brand_color: string | null;
  brand_logo_url: string | null;
  is_primary: boolean;
  relationship_status: BrandRelationshipStatus;
  customer_code: string | null;
  relationship_started_at: string | null;
  relationship_ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddCompanyBrandInput {
  companyId: string;
  brandId: string;
  relationshipStatus?: BrandRelationshipStatus;
  isPrimary?: boolean;
  customerCode?: string | null;
  relationshipStartedAt?: string | null;
  relationshipEndedAt?: string | null;
  notes?: string | null;
}

export interface UpdateCompanyBrandInput {
  companyId: string;
  brandId: string;
  relationshipStatus?: BrandRelationshipStatus;
  isPrimary?: boolean;
  customerCode?: string | null;
  relationshipStartedAt?: string | null;
  relationshipEndedAt?: string | null;
  notes?: string | null;
}

const SELECT_FULL =
  "company_id,brand_id,is_primary,relationship_status,customer_code,relationship_started_at,relationship_ended_at,notes,created_at,updated_at,brands(name,slug,short_code,color,logo_url)";
const SELECT_WITH_REL =
  "company_id,brand_id,is_primary,relationship_status,created_at,updated_at,brands(name,slug,short_code,color,logo_url)";
const SELECT_BASE =
  "company_id,brand_id,is_primary,created_at,brands(name,slug,short_code,color,logo_url)";

let cachedSelect: string | null = null;
let cachedSchema: CompanyBrandsSchemaCapabilities | null = null;

type CompanyBrandRow = {
  company_id: string;
  brand_id: string;
  is_primary: boolean;
  relationship_status?: string | null;
  customer_code?: string | null;
  relationship_started_at?: string | null;
  relationship_ended_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  brands:
    | {
        name: string;
        slug: string;
        short_code: string | null;
        color: string | null;
        logo_url: string | null;
      }
    | {
        name: string;
        slug: string;
        short_code: string | null;
        color: string | null;
        logo_url: string | null;
      }[]
    | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function schemaFromSelect(select: string): CompanyBrandsSchemaCapabilities {
  return {
    hasRelationshipStatus: select.includes("relationship_status"),
    hasCustomerCode: select.includes("customer_code"),
  };
}

function nextSelectFallback(current: string): string | null {
  if (current === SELECT_FULL) return SELECT_WITH_REL;
  if (current === SELECT_WITH_REL) return SELECT_BASE;
  if (current.includes("customer_code")) return SELECT_WITH_REL;
  if (current.includes("relationship_status")) return SELECT_BASE;
  return null;
}

async function resolveCompanyCommercialStatus(
  companyId: string
): Promise<BrandRelationshipStatus> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("companies")
    .select("commercial_status")
    .eq("id", companyId)
    .maybeSingle();
  const status = data?.commercial_status;
  if (
    status === "cliente" ||
    status === "prospect" ||
    status === "ex_cliente" ||
    status === "da_ricontattare" ||
    status === "non_interessato"
  ) {
    return commercialStatusToBrandRelationship(status) ?? "prospect";
  }
  return "prospect";
}

function mapCompanyBrandRow(
  row: CompanyBrandRow,
  fallbackStatus: BrandRelationshipStatus
): CompanyBrandItem | null {
  const brand = relationOne(row.brands);
  if (!brand) return null;

  const relationship = isBrandRelationshipStatus(row.relationship_status)
    ? row.relationship_status
    : fallbackStatus;

  return {
    company_id: row.company_id,
    brand_id: row.brand_id,
    brand_name: brand.name,
    brand_slug: brand.slug,
    brand_short_code: brand.short_code,
    brand_color: brand.color,
    brand_logo_url: brand.logo_url,
    is_primary: row.is_primary,
    relationship_status: relationship,
    customer_code: row.customer_code ?? null,
    relationship_started_at: row.relationship_started_at ?? null,
    relationship_ended_at: row.relationship_ended_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

async function selectCompanyBrands(
  companyId: string,
  brandId?: string
): Promise<{ data: CompanyBrandRow[]; error: string | null; schema: CompanyBrandsSchemaCapabilities }> {
  const supabase = await createServerClient();
  let select = cachedSelect ?? SELECT_FULL;

  for (;;) {
    let query = supabase.from("company_brands").select(select).eq("company_id", companyId);
    if (brandId) {
      query = query.eq("brand_id", brandId);
    } else {
      query = query.order("is_primary", { ascending: false }).order("brand_id", { ascending: true });
    }

    const { data, error } = await query;
    if (!error) {
      cachedSelect = select;
      cachedSchema = schemaFromSelect(select);
      return {
        data: (data ?? []) as unknown as CompanyBrandRow[],
        error: null,
        schema: cachedSchema,
      };
    }

    if (!isMissingCompanyBrandsColumnError(error)) {
      return {
        data: [],
        error: describeDbError(error),
        schema: cachedSchema ?? { hasRelationshipStatus: false, hasCustomerCode: false },
      };
    }

    const fallback = nextSelectFallback(select);
    if (!fallback) {
      return {
        data: [],
        error: describeDbError(error),
        schema: { hasRelationshipStatus: false, hasCustomerCode: false },
      };
    }
    select = fallback;
  }
}

export function getCompanyBrandsSchemaCapabilities(): CompanyBrandsSchemaCapabilities | null {
  return cachedSchema;
}

/** Svuota il flag primario su tutte le associazioni dell'azienda. */
async function clearPrimaryForCompany(
  companyId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("company_brands")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (error) {
    return { error: describeDbError(error) };
  }
  return { error: null };
}

export async function listCompanyBrands(
  companyId: string
): Promise<{ data: CompanyBrandItem[]; error: string | null }> {
  const result = await selectCompanyBrands(companyId);
  if (result.error) {
    return { data: [], error: result.error };
  }

  const fallback = result.schema.hasRelationshipStatus
    ? ("prospect" as BrandRelationshipStatus)
    : await resolveCompanyCommercialStatus(companyId);

  const items = result.data
    .map((row) => mapCompanyBrandRow(row, fallback))
    .filter((item): item is CompanyBrandItem => item !== null);

  return { data: items, error: null };
}

export async function getCompanyBrand(
  companyId: string,
  brandId: string
): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  const result = await selectCompanyBrands(companyId, brandId);
  if (result.error) {
    return { data: null, error: result.error };
  }
  if (result.data.length === 0) {
    return { data: null, error: null };
  }

  const fallback = result.schema.hasRelationshipStatus
    ? ("prospect" as BrandRelationshipStatus)
    : await resolveCompanyCommercialStatus(companyId);

  return { data: mapCompanyBrandRow(result.data[0], fallback), error: null };
}

/**
 * Aggiunge (o aggiorna se già presente) l'associazione azienda–marchio.
 * Schema-aware: non scrive colonne assenti sul DB live.
 */
export async function addCompanyBrand(
  input: AddCompanyBrandInput
): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  const status = input.relationshipStatus ?? "prospect";
  if (!isBrandRelationshipStatus(status)) {
    return { data: null, error: "Stato relazione marchio non valido." };
  }

  // Probe schema
  const probe = await selectCompanyBrands(input.companyId);
  if (probe.error && probe.data.length === 0 && cachedSchema == null) {
    // azienda senza brand: probe fallito — riprova select vuoto ok
  }
  const schema = cachedSchema ?? {
    hasRelationshipStatus: true,
    hasCustomerCode: true,
  };

  if (input.isPrimary) {
    const cleared = await clearPrimaryForCompany(input.companyId);
    if (cleared.error) {
      return { data: null, error: cleared.error };
    }
  }

  const supabase = await createServerClient();
  let writeSchema = schema;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const payload = buildCompanyBrandWritePayload(
      {
        companyId: input.companyId,
        brandId: input.brandId,
        relationshipStatus: status,
        customerCode: input.customerCode?.trim() || null,
        isPrimary: Boolean(input.isPrimary),
        schema: writeSchema,
      },
      "insert"
    );

    // Note / date solo se schema full (presence of relationship columns implies migration applied)
    if (writeSchema.hasRelationshipStatus) {
      if (input.relationshipStartedAt !== undefined) {
        payload.relationship_started_at = input.relationshipStartedAt || null;
      }
      if (input.relationshipEndedAt !== undefined) {
        payload.relationship_ended_at = input.relationshipEndedAt || null;
      }
      if (input.notes !== undefined) {
        payload.notes = input.notes?.trim() || null;
      }
    }

    const { error } = await supabase.from("company_brands").upsert(payload as never, {
      onConflict: "company_id,brand_id",
    });

    if (!error) {
      cachedSchema = writeSchema;
      return getCompanyBrand(input.companyId, input.brandId);
    }

    if (!isMissingCompanyBrandsColumnError(error)) {
      return { data: null, error: describeDbError(error) };
    }

    lastError = describeDbError(error);
    // Degrade schema
    if (writeSchema.hasCustomerCode) {
      writeSchema = { ...writeSchema, hasCustomerCode: false };
    } else if (writeSchema.hasRelationshipStatus) {
      writeSchema = { hasRelationshipStatus: false, hasCustomerCode: false };
    } else {
      break;
    }
  }

  return { data: null, error: lastError ?? "Impossibile salvare l'associazione brand." };
}

export async function updateCompanyBrand(
  input: UpdateCompanyBrandInput
): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  if (
    input.relationshipStatus != null &&
    !isBrandRelationshipStatus(input.relationshipStatus)
  ) {
    return { data: null, error: "Stato relazione marchio non valido." };
  }

  if (input.isPrimary === true) {
    const cleared = await clearPrimaryForCompany(input.companyId);
    if (cleared.error) {
      return { data: null, error: cleared.error };
    }
  }

  // Ensure schema known
  await selectCompanyBrands(input.companyId, input.brandId);
  let writeSchema = cachedSchema ?? {
    hasRelationshipStatus: true,
    hasCustomerCode: true,
  };

  const supabase = await createServerClient();
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const patch = buildCompanyBrandWritePayload(
      {
        companyId: input.companyId,
        brandId: input.brandId,
        relationshipStatus: input.relationshipStatus ?? "prospect",
        customerCode:
          input.customerCode !== undefined
            ? input.customerCode?.trim() || null
            : null,
        isPrimary: input.isPrimary ?? false,
        schema: writeSchema,
      },
      "update"
    );

    // Solo campi esplicitamente richiesti
    const finalPatch: Record<string, unknown> = {};
    if (input.isPrimary !== undefined) {
      finalPatch.is_primary = input.isPrimary;
    }
    if (input.relationshipStatus !== undefined && writeSchema.hasRelationshipStatus) {
      finalPatch.relationship_status = input.relationshipStatus;
    }
    if (input.customerCode !== undefined && writeSchema.hasCustomerCode) {
      finalPatch.customer_code = input.customerCode?.trim() || null;
    }
    if (writeSchema.hasRelationshipStatus) {
      if (input.relationshipStartedAt !== undefined) {
        finalPatch.relationship_started_at = input.relationshipStartedAt || null;
      }
      if (input.relationshipEndedAt !== undefined) {
        finalPatch.relationship_ended_at = input.relationshipEndedAt || null;
      }
      if (input.notes !== undefined) {
        finalPatch.notes = input.notes?.trim() || null;
      }
    }

    // Se solo is_primary e già gestito, o patch vuoto
    if (Object.keys(finalPatch).length === 0) {
      // rebuild from buildCompanyBrandWritePayload when isPrimary was in input
      if (input.isPrimary !== undefined) {
        finalPatch.is_primary = Boolean(patch.is_primary);
      } else {
        return getCompanyBrand(input.companyId, input.brandId);
      }
    }

    const { error } = await supabase
      .from("company_brands")
      .update(finalPatch as never)
      .eq("company_id", input.companyId)
      .eq("brand_id", input.brandId);

    if (!error) {
      cachedSchema = writeSchema;
      return getCompanyBrand(input.companyId, input.brandId);
    }

    if (!isMissingCompanyBrandsColumnError(error)) {
      return { data: null, error: describeDbError(error) };
    }

    lastError = describeDbError(error);
    if (writeSchema.hasCustomerCode) {
      writeSchema = { ...writeSchema, hasCustomerCode: false };
    } else if (writeSchema.hasRelationshipStatus) {
      writeSchema = { hasRelationshipStatus: false, hasCustomerCode: false };
    } else {
      break;
    }
  }

  return { data: null, error: lastError ?? "Impossibile aggiornare l'associazione brand." };
}

export async function setPrimaryCompanyBrand(
  companyId: string,
  brandId: string
): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  return updateCompanyBrand({
    companyId,
    brandId,
    isPrimary: true,
  });
}

export async function removeCompanyBrand(
  companyId: string,
  brandId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("company_brands")
    .delete()
    .eq("company_id", companyId)
    .eq("brand_id", brandId);

  if (error) {
    return { error: describeDbError(error) };
  }

  return { error: null };
}
