"use server";

import { revalidatePath } from "next/cache";
import { isGeoapifyConfigured } from "@/lib/geoapify/env";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runCompanyGeocodingBatch } from "../services/company-geocoding.service";

export interface GeocodeCompaniesActionResult {
  success: boolean;
  message: string;
  processed: number;
  succeeded: number;
  failed: number;
  needsReview: number;
}

export async function geocodeCompaniesAction(): Promise<GeocodeCompaniesActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: "Database non configurato.",
      processed: 0,
      succeeded: 0,
      failed: 0,
      needsReview: 0,
    };
  }

  if (!isGeoapifyConfigured()) {
    return {
      success: false,
      message: "GEOAPIFY_API_KEY non configurata.",
      processed: 0,
      succeeded: 0,
      failed: 0,
      needsReview: 0,
    };
  }

  const result = await runCompanyGeocodingBatch();

  revalidatePath("/companies");

  return {
    success: result.processed > 0 && result.failed < result.processed,
    message: result.message,
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    needsReview: result.needsReview,
  };
}
