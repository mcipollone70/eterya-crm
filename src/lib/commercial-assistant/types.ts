import type { PriorityTier } from "@/lib/commercial-priority/types";

export interface DailySuggestionSignals {
  distanceKm: number | null;
  daysSinceLastVisit: number | null;
  hasOverdueFollowUp: boolean;
  openOpportunityCount: number;
  maxOpportunityProbability: number | null;
  openPipelineValue: number;
  revenue: number | null;
  hasHighProductInterest: boolean;
  purchasedProductCount: number;
}

export interface DailyVisitSuggestion {
  companyId: string;
  companyName: string;
  city: string | null;
  province: string | null;
  commercialStatus: string;
  score: number;
  tier: PriorityTier;
  reasons: string[];
  signals: DailySuggestionSignals;
}

export interface CompanyVisitBriefing {
  companyId: string;
  companyName: string;
  city: string | null;
  province: string | null;
  commercialStatus: string;
  notes: string | null;
  internalNotes: string | null;
  lastVisit: {
    at: string | null;
    outcome: string | null;
    notes: string | null;
    durationMinutes: number | null;
    nextCallbackAt: string | null;
  };
  lastContact: {
    at: string | null;
    type: string | null;
  };
  opportunities: {
    openCount: number;
    totalValue: number;
    averageProbability: number;
    items: Array<{
      id: string;
      title: string;
      stage: string;
      amount: number;
      probability: number | null;
    }>;
  };
  products: {
    purchased: Array<{ name: string; family: string }>;
    interests: Array<{ name: string; family: string; level: string | null }>;
  };
  followUps: Array<{
    id: string;
    activityType: string;
    description: string | null;
    scheduledAt: string;
    status: string;
    priority: string;
  }>;
  recentContacts: Array<{
    id: string;
    type: string;
    title: string;
    occurredAt: string;
    outcome: string | null;
  }>;
}

export interface OpportunityAggregate {
  count: number;
  totalValue: number;
  maxProbability: number | null;
}
