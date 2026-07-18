/**
 * Commercial radar — opportunistic slots from day context + CRM proposals.
 * Max 5 proposals. Triggers: free time, cancel, early finish, GPS, urgent FU, stale opp, quote expiry.
 */

import "server-only";

import { buildUnifiedCommercialProposals } from "@/features/joy/chat/services/joy-commercial-proposals.service";
import { createServerClient } from "@/lib/supabase/server";
import {
  decisionsFromProposals,
  mergeJoyDecisions,
  formatDecisionTransparency,
} from "../decision/joy-decision-engine";
import { applyCautionHeuristics } from "../decision/joy-contradiction";
import type { JoyOsDecision, JoyOsObserveContext } from "../types";
import { joySafeLog } from "../logging/joy-safe-logger";

export const JOY_RADAR_MAX = 5;

export type JoyRadarTrigger =
  | "free_time"
  | "cancelled"
  | "early_finish"
  | "position"
  | "urgent_follow_up"
  | "stale_opportunity"
  | "quote_expiry"
  | "general";

export interface JoyRadarInput {
  userId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  freeMinutes?: number | null;
  cancelledVisitCount?: number;
  earlyFinish?: boolean;
  triggers?: JoyRadarTrigger[];
}

export interface JoyRadarResult {
  proposals: JoyOsDecision[];
  triggersUsed: JoyRadarTrigger[];
  summaryText: string;
}

async function countExpiringQuotes(userId: string | null): Promise<{
  count: number;
  sampleCompany: string | null;
  sampleId: string | null;
}> {
  try {
    const supabase = await createServerClient();
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    let query = supabase
      .from("quotes")
      .select("id,company_id,valid_until,companies(name)")
      .not("valid_until", "is", null)
      .gte("valid_until", now.toISOString().slice(0, 10))
      .lte("valid_until", in14.toISOString().slice(0, 10))
      .limit(8);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data } = await query;
    const rows = (data ?? []) as Array<{
      id: string;
      company_id: string | null;
      valid_until: string | null;
      companies: { name?: string } | Array<{ name?: string }> | null;
    }>;
    const first = rows[0];
    const company = first
      ? Array.isArray(first.companies)
        ? first.companies[0]
        : first.companies
      : null;

    return {
      count: rows.length,
      sampleCompany: company?.name ?? null,
      sampleId: first?.company_id ?? null,
    };
  } catch (error) {
    joySafeLog("warn", "radar", "quote expiry query failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { count: 0, sampleCompany: null, sampleId: null };
  }
}

function inferTriggers(input: JoyRadarInput): JoyRadarTrigger[] {
  if (input.triggers?.length) return input.triggers;
  const triggers: JoyRadarTrigger[] = ["general"];
  if ((input.freeMinutes ?? 0) >= 30) triggers.push("free_time");
  if ((input.cancelledVisitCount ?? 0) > 0) triggers.push("cancelled");
  if (input.earlyFinish) triggers.push("early_finish");
  if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    triggers.push("position");
  }
  return triggers;
}

/**
 * Build up to 5 transparent commercial radar proposals.
 */
export async function buildCommercialRadar(
  input: JoyRadarInput
): Promise<JoyRadarResult> {
  const triggersUsed = inferTriggers(input);
  const [proposals, expiring] = await Promise.all([
    buildUnifiedCommercialProposals({
      userId: input.userId,
      latitude: input.latitude,
      longitude: input.longitude,
      limit: 12,
    }),
    countExpiringQuotes(input.userId),
  ]);

  let decisions = applyCautionHeuristics(decisionsFromProposals(proposals));

  if (expiring.count > 0) {
    decisions = mergeJoyDecisions(decisions, [
      {
        id: "radar-quote-expiry",
        kind: "quote_chase",
        action: expiring.sampleCompany
          ? `Prepara chiamata ${expiring.sampleCompany}`
          : "Preventivi in scadenza",
        title: `${expiring.count} preventivi in scadenza (14gg)`,
        reason: `Hai ${expiring.count} preventivi con validità entro 14 giorni${
          expiring.sampleCompany ? ` (es. ${expiring.sampleCompany})` : ""
        }. Ti consiglio di richiamare prima che scadano.`,
        dataUsed: ["quotes.valid_until", "quotes.status"],
        urgency: "high",
        commercialValueEur: null,
        distanceKm: null,
        timeHint: "~15 min per chiamata",
        estimatedMinutes: 15,
        confidence: "medium",
        missingData: expiring.sampleId ? [] : ["companyId"],
        stance: "recommend",
        score: 88,
        companyId: expiring.sampleId,
        companyName: expiring.sampleCompany,
        impactEstimate: "Stima operativa su scadenze CRM — non è una previsione di chiusura.",
      },
    ]);
  }

  if (triggersUsed.includes("free_time") || triggersUsed.includes("early_finish")) {
    decisions = decisions.map((d) =>
      d.kind === "visit" || d.kind === "prospect" || d.kind === "call"
        ? {
            ...d,
            score: Math.min(100, d.score + 8),
            reason: `${d.reason} Slot libero / chiusura anticipata: buona finestra operativa.`,
          }
        : d
    );
  }

  if (triggersUsed.includes("cancelled")) {
    decisions = decisions.map((d) =>
      d.kind === "visit" || d.kind === "prospect"
        ? {
            ...d,
            score: Math.min(100, d.score + 6),
            reason: `${d.reason} Hai avuto cancellazioni: riempi il buco con qualcosa di vicino.`,
          }
        : d
    );
  }

  const top = mergeJoyDecisions(decisions).slice(0, JOY_RADAR_MAX);

  const summaryText =
    top.length === 0
      ? "Radar commerciale: nessun segnale urgente dai dati CRM attuali."
      : [
          "**Radar commerciale** (max 5, solo dati CRM — nessuna azione automatica):",
          "",
          ...top.map((d, i) => `${i + 1}. ${d.title} — «${d.action}»`),
          "",
          `Trigger: ${triggersUsed.join(", ")}.`,
          "Dimmi il numero o l'azione per approfondire. Nessun salvataggio senza conferma.",
        ].join("\n");

  return { proposals: top, triggersUsed, summaryText };
}

export function formatRadarDecisionDetail(decision: JoyOsDecision): string {
  return formatDecisionTransparency(decision);
}

export async function buildRadarFromObserveContext(
  context: JoyOsObserveContext & {
    freeMinutes?: number | null;
    cancelledVisitCount?: number;
    earlyFinish?: boolean;
  }
): Promise<JoyRadarResult> {
  return buildCommercialRadar({
    userId: context.userId,
    latitude: context.latitude,
    longitude: context.longitude,
    freeMinutes: context.freeMinutes,
    cancelledVisitCount: context.cancelledVisitCount,
    earlyFinish: context.earlyFinish,
  });
}
