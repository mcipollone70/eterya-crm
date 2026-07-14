import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";

const EXCLUDED_KEYWORDS = [
  "liquidazione",
  "in liquidazione",
  "in liquidaz",
  "cessata",
  "cessato",
  "cessazione",
  "fallita",
  "fallito",
  "scioglimento",
] as const;

function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function payloadContainsExcludedKeyword(payload: Json | null): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  for (const value of Object.values(payload)) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeText(value.trim());
    if (EXCLUDED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return true;
    }
  }

  return false;
}

export function isCompanyPriorityExcluded(input: {
  companyStatus: CompanyStatus;
  name: string;
  importPayload: Json | null;
}): boolean {
  if (input.companyStatus === "archived" || input.companyStatus === "inactive") {
    return true;
  }

  const normalizedName = normalizeText(input.name);
  if (EXCLUDED_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return true;
  }

  return payloadContainsExcludedKeyword(input.importPayload);
}

export function daysSince(dateValue: string | null): number | null {
  if (!dateValue) {
    return null;
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}
