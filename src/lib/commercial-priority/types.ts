import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";

export type PriorityTier = "high" | "medium" | "low" | "none";

export interface CommercialPriorityInput {
  commercialStatus: CommercialStatus;
  companyStatus: CompanyStatus;
  name: string;
  importPayload: Json | null;
  revenue: number | null;
  lastVisitAt: string | null;
  lastContactAt: string | null;
  hasOpenOpportunity: boolean;
  distanceKm: number | null;
  alongActiveRoute: boolean;
}

export interface CommercialPriorityResult {
  score: number;
  tier: PriorityTier;
  excluded: boolean;
}

export interface PriorityDashboardMetrics {
  highPriority: number;
  contactToday: number;
  inactiveClients90Days: number;
  unvisitedProspects: number;
}

export interface CompanyPriorityFields {
  priority_score: number;
  priority_tier: PriorityTier;
  priority_excluded: boolean;
}

export interface PriorityContext {
  lastVisitByCompany: Record<string, string>;
  lastContactByCompany: Record<string, string>;
  openOpportunityCompanies: string[];
}

export interface CompanyPrioritySource {
  id: string;
  name: string;
  status: CompanyStatus;
  commercial_status: CommercialStatus | null;
  revenue: number | null;
  import_payload: Json | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PriorityComputationOptions {
  distanceKm?: number | null;
  alongActiveRoute?: boolean;
}
