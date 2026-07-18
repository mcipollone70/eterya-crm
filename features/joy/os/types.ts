/**
 * Joy OS — shared types for the commercial operating system.
 * Intent: agent speaks, Joy observes / reasons / proposes / confirms.
 */

import type { JoyIntent } from "@/features/joy/chat/utils/parse-joy-intent";
import type { JoyConversationMemory } from "@/features/joy/chat/types/joy-session";
import type { JoyCommercialProposal } from "@/features/joy/chat/services/joy-commercial-proposals.service";
import type { JoyCoachRecommendation } from "@/features/joy/tools/get-commercial-coach";

export type JoyOsPhase =
  | "observe"
  | "reason"
  | "propose"
  | "confirm"
  | "learn"
  | "idle";

export type JoyOsTrigger =
  | "user_message"
  | "day_start"
  | "day_end"
  | "visit_end"
  | "cancellation"
  | "free_slot"
  | "midday"
  | "weekly"
  | "monthly"
  | "proactive_tick";

export type JoyDecisionKind =
  | "call"
  | "visit"
  | "follow_up"
  | "quote_chase"
  | "sample_recovery"
  | "tour"
  | "briefing"
  | "debrief"
  | "coach"
  | "strategy"
  | "reschedule"
  | "prospect"
  | "recover_lost";

export type JoyDecisionUrgency = "critical" | "high" | "medium" | "low";
export type JoyDecisionConfidence = "high" | "medium" | "low" | "insufficient";
export type JoyDecisionStance = "recommend" | "caution" | "discourage";

export interface JoyOsDecision {
  id: string;
  kind: JoyDecisionKind;
  /** Explicit next action the agent can take / say */
  action: string;
  title: string;
  reason: string;
  /** Real CRM signals used for this decision (transparent, never opaque) */
  dataUsed: string[];
  urgency: JoyDecisionUrgency;
  /** Soft commercial value estimate in EUR when calculable — never a promise */
  commercialValueEur?: number | null;
  distanceKm?: number | null;
  /** Wall-clock or duration hint */
  timeHint?: string | null;
  estimatedMinutes?: number | null;
  confidence: JoyDecisionConfidence;
  missingData: string[];
  stance: JoyDecisionStance;
  /** 0–100 commercial priority from real CRM signals only — not a black-box score */
  score: number;
  companyId?: string | null;
  companyName?: string | null;
  href?: string | null;
  /** Human-readable impact — estimates only, never promises */
  impactEstimate?: string | null;
}

export type JoyProactiveKind =
  | "free_time"
  | "nearby_client"
  | "urgent_follow_up"
  | "forgotten_quote"
  | "stale_opportunity"
  | "lost_client"
  | "inactive_client"
  | "new_client"
  | "morning_plan"
  | "midday_adjust"
  | "evening_eod"
  | "weekly_strategy"
  | "monthly_plan"
  | "coach_nudge";

export interface JoyProactiveIntervention {
  id: string;
  kind: JoyProactiveKind;
  urgency: "high" | "medium" | "low";
  title: string;
  message: string;
  /** Prompt the agent can tap / say to act */
  suggestedPrompt: string;
  score: number;
  companyId?: string | null;
  companyName?: string | null;
}

export type JoyStrategyFocus =
  | "revenue"
  | "product_family"
  | "zone"
  | "lost_clients"
  | "sales_goal"
  | "showroom"
  | "pipeline_velocity"
  | "general";

export interface JoyStrategyRequest {
  focus: JoyStrategyFocus;
  /** e.g. VEPA, zanzariere */
  productFamily?: string | null;
  /** e.g. Latina, Sezze */
  zone?: string | null;
  /** Target amount when focus is sales_goal */
  amount?: number | null;
  period?: "week" | "month" | "year" | null;
}

export interface JoyStrategyInsight {
  focus: JoyStrategyFocus;
  headline: string;
  /** Honest narrative from CRM aggregates only */
  narrative: string;
  levers: Array<{
    title: string;
    evidence: string;
    /** Soft estimate — never a promise */
    estimateNote: string;
  }>;
  dataQuality: "sufficient" | "partial" | "insufficient";
  insufficientNote?: string;
}

export interface JoyAgentLearningSnapshot {
  sampleSize: {
    completedVisits: number;
    wonOpportunities: number;
    lostOpportunities: number;
    followUpsClosed: number;
  };
  patterns: Array<{
    id: string;
    label: string;
    finding: string;
    confidence: "high" | "medium" | "low" | "insufficient";
  }>;
  strengths: string[];
  inefficiencies: string[];
  summaryText: string;
}

/** Long commercial life memory beyond a single chat turn (localStorage). */
export interface JoyLongTermMemory {
  promises: Array<{
    id: string;
    text: string;
    companyId?: string | null;
    companyName?: string | null;
    dueDate?: string | null;
    createdAt: string;
  }>;
  preferences: {
    preferredZones?: string[];
    preferredProductFamilies?: string[];
    quietHours?: string | null;
    maxStopsDefault?: number | null;
  };
  clientNotes: Array<{
    companyId: string;
    companyName?: string | null;
    note: string;
    updatedAt: string;
  }>;
  successes: Array<{
    id: string;
    text: string;
    companyId?: string | null;
    createdAt: string;
  }>;
  errors: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
  lastDayStartAt?: string | null;
  lastDayEndAt?: string | null;
  lastWeeklyReviewAt?: string | null;
  updatedAt?: string | null;
}

export interface JoyOsObserveContext {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  companyId?: string | null;
  memory?: JoyConversationMemory | null;
  trigger?: JoyOsTrigger;
  hour?: number;
}

export interface JoyOsReasoningResult {
  phase: JoyOsPhase;
  trigger: JoyOsTrigger;
  decisions: JoyOsDecision[];
  interventions: JoyProactiveIntervention[];
  proposals: JoyCommercialProposal[];
  coach?: JoyCoachRecommendation[];
  strategy?: JoyStrategyInsight | null;
  learning?: JoyAgentLearningSnapshot | null;
  recommendedPrompt: string;
  narrative: string;
}

/** Compact Command Center payload — one intelligence surface for the agent. */
export interface JoyCommandCenterCard {
  id: string;
  title: string;
  action: string;
  reason: string;
  urgency: JoyDecisionUrgency;
  distanceKm?: number | null;
  timeHint?: string | null;
  commercialValueEur?: number | null;
  companyId?: string | null;
  companyName?: string | null;
  href?: string | null;
  stance: JoyDecisionStance;
  explainPrompt: string;
}

export interface JoyCommandCenterFreeTimeItem {
  id: string;
  title: string;
  reason: string;
  estimatedMinutes: number;
  companyId?: string | null;
  companyName?: string | null;
  prompt: string;
}

export interface JoyCommandCenterStrategyChip {
  id: string;
  label: string;
  prompt: string;
}

export interface JoyCommandCenterSnapshot {
  version: string;
  narrative: string;
  /** Synthetic one-liner for Dashboard «Apri Joy» */
  syntheticSummary: string;
  dayStart: {
    headline: string;
    recommendation: string;
    followPrompt: string;
    organizePrompt: string;
  };
  adviceNow: JoyCommandCenterCard[];
  prioritiesToday: JoyCommandCenterCard[];
  freeTime: JoyCommandCenterFreeTimeItem[];
  nextAction: JoyCommandCenterCard | null;
  strategyChips: JoyCommandCenterStrategyChip[];
  recommendedPrompt: string;
  error: string | null;
}

export type { JoyIntent, JoyConversationMemory, JoyCommercialProposal };
