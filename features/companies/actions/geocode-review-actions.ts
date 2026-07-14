"use server";

import { revalidatePath } from "next/cache";
import { isGeoapifyConfigured } from "@/lib/geoapify/env";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  confirmGeocodePosition,
  regeocodeCompanyWithAddress,
} from "../services/company-geocoding.service";
import type { AddressCorrectionInput } from "../types/geocoding";

function revalidateGeocodingPaths() {
  revalidatePath("/companies");
  revalidatePath("/companies/geocoding/review");
}

export async function confirmGeocodePositionAction(
  companyId: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: "Database non configurato." };
  }

  const result = await confirmGeocodePosition(companyId);

  if (result.success) {
    revalidateGeocodingPaths();
  }

  return result;
}

export async function regeocodeCompanyAction(
  companyId: string,
  addressUpdate: AddressCorrectionInput
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: "Database non configurato." };
  }

  if (!isGeoapifyConfigured()) {
    return { success: false, message: "GEOAPIFY_API_KEY non configurata." };
  }

  const result = await regeocodeCompanyWithAddress(companyId, addressUpdate);

  if (result.success) {
    revalidateGeocodingPaths();
  }

  return { success: result.success, message: result.message };
}
