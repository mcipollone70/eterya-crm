"use server";

import { isGeoapifyConfigured } from "@/lib/geoapify/env";
import { geocodeWithGeoapify } from "@/features/companies/services/geoapify.provider";

export async function geocodeDestinationAddressAction(
  address: string
): Promise<{
  success: boolean;
  message: string;
  lat?: number;
  lng?: number;
  label?: string;
}> {
  if (!isGeoapifyConfigured()) {
    return {
      success: false,
      message: "GEOAPIFY_API_KEY non configurata per geocodificare l'indirizzo.",
    };
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return { success: false, message: "Inserisci un indirizzo di destinazione." };
  }

  try {
    const result = await geocodeWithGeoapify(trimmed);
    return {
      success: true,
      message: "Destinazione geocodificata.",
      lat: result.latitude,
      lng: result.longitude,
      label: result.normalizedAddress,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Geocodifica non riuscita.",
    };
  }
}
