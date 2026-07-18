"use server";

import { revalidatePath } from "next/cache";
import { revalidateDashboardPaths } from "@/lib/revalidate/dashboard-paths";
import { isBrandRelationshipStatus } from "@/lib/constants/brand-relationship";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BrandRelationshipStatus } from "@/lib/supabase/types";
import {
  addCompanyBrand,
  listCompanyBrands,
  removeCompanyBrand,
  setPrimaryCompanyBrand,
  updateCompanyBrand,
  type CompanyBrandItem,
} from "../services/company-brands.service";
import { listBrands } from "../services/brands.service";

const NOT_CONFIGURED =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

function revalidateCompanySurfaces(companyId: string) {
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  revalidatePath("/maps");
  revalidatePath("/contacts");
  revalidateDashboardPaths();
}

export async function listCompanyBrandsAction(
  companyId: string
): Promise<{ data: CompanyBrandItem[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: [], error: NOT_CONFIGURED };
  }
  return listCompanyBrands(companyId);
}

export async function listActiveBrandsAction() {
  if (!isSupabaseConfigured()) {
    return { data: [], error: NOT_CONFIGURED };
  }
  return listBrands({ activeOnly: true });
}

export async function addCompanyBrandAction(input: {
  companyId: string;
  brandId: string;
  relationshipStatus?: BrandRelationshipStatus;
  isPrimary?: boolean;
  customerCode?: string | null;
}): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: NOT_CONFIGURED };
  }
  if (
    input.relationshipStatus != null &&
    !isBrandRelationshipStatus(input.relationshipStatus)
  ) {
    return { data: null, error: "Stato relazione non valido." };
  }

  const result = await addCompanyBrand({
    companyId: input.companyId,
    brandId: input.brandId,
    relationshipStatus: input.relationshipStatus,
    isPrimary: input.isPrimary,
    customerCode: input.customerCode,
  });

  if (!result.error) {
    revalidateCompanySurfaces(input.companyId);
  }
  return result;
}

export async function updateCompanyBrandAction(input: {
  companyId: string;
  brandId: string;
  relationshipStatus?: BrandRelationshipStatus;
  isPrimary?: boolean;
  customerCode?: string | null;
}): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: NOT_CONFIGURED };
  }
  if (
    input.relationshipStatus != null &&
    !isBrandRelationshipStatus(input.relationshipStatus)
  ) {
    return { data: null, error: "Stato relazione non valido." };
  }

  const result = await updateCompanyBrand(input);
  if (!result.error) {
    revalidateCompanySurfaces(input.companyId);
  }
  return result;
}

export async function setPrimaryCompanyBrandAction(
  companyId: string,
  brandId: string
): Promise<{ data: CompanyBrandItem | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: NOT_CONFIGURED };
  }
  const result = await setPrimaryCompanyBrand(companyId, brandId);
  if (!result.error) {
    revalidateCompanySurfaces(companyId);
  }
  return result;
}

export async function removeCompanyBrandAction(
  companyId: string,
  brandId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED };
  }
  const result = await removeCompanyBrand(companyId, brandId);
  if (!result.error) {
    revalidateCompanySurfaces(companyId);
  }
  return result;
}
