"use server";

import {
  getGeoapifyConfigView,
  verifyGeoapifyApiKeyReadable,
} from "@/lib/geoapify/env";
import type { GeoapifyConfigView } from "../types/geocoding";

export interface GeoapifyConfigCheckResult extends GeoapifyConfigView {
  /** Lunghezza chiave letta dal server — mai il valore. */
  keyLength: number;
}

/** Verifica server-side che GEOAPIFY_API_KEY sia configurata e leggibile. */
export async function checkGeoapifyConfigAction(): Promise<GeoapifyConfigCheckResult> {
  const view = getGeoapifyConfigView();
  const verification = verifyGeoapifyApiKeyReadable();

  return {
    ...view,
    keyLength: verification.keyLength,
  };
}
