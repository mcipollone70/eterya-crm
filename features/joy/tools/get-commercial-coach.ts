import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { getStaleOpportunities, getOpportunities } from "@/features/joy/tools/get-opportunities";
import { getOverdueFollowUps } from "@/features/joy/tools/get-follow-ups";
import { emptyToolResult, successToolResult, type JoyToolResult } from "@/features/joy/tools/types";

export interface JoyCoachRecommendation {
  kind:
    | "visit"
    | "call"
    | "churn_risk"
    | "high_win"
    | "neglected"
    | "prospect"
    | "deprioritize";
  score: number;
  title: string;
  reason: string;
  companyId?: string | null;
  companyName?: string | null;
  estimatedMinutes?: number | null;
}

export interface JoyCommercialCoachSnapshot {
  recommendations: JoyCoachRecommendation[];
  summaryText: string;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

/**
 * Commercial coach: ragionamento da direttore vendite su dati CRM reali.
 * Nessuna mutazione — solo raccomandazioni con evidenza.
 */
export async function getCommercialCoach(options?: {
  userId?: string | null;
  limit?: number;
}): Promise<JoyToolResult<JoyCommercialCoachSnapshot | null>> {
  const limit = options?.limit ?? 8;
  const userId = options?.userId ?? null;

  try {
    const supabase = await createServerClient();
    const { applyAgentCompanyScope } = await import(
      "@/features/companies/utils/agent-company-scope"
    );

    let inactiveQuery = supabase
      .from("companies")
      .select("id,name,city,commercial_status,last_visit_at,updated_at")
      .eq("commercial_status", "cliente")
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(20);
    if (userId) {
      inactiveQuery = applyAgentCompanyScope(inactiveQuery, userId);
    }

    let prospectsQuery = supabase
      .from("companies")
      .select("id,name,city,commercial_status,updated_at")
      .eq("commercial_status", "prospect")
      .order("updated_at", { ascending: false })
      .limit(15);
    if (userId) {
      prospectsQuery = applyAgentCompanyScope(prospectsQuery, userId);
    }

    const [opps, stale, overdue, inactiveClients, prospects] = await Promise.all([
      getOpportunities({ limit: 40 }),
      getStaleOpportunities({ limit: 10 }),
      getOverdueFollowUps({ limit: 10 }),
      inactiveQuery,
      prospectsQuery,
    ]);

    const recommendations: JoyCoachRecommendation[] = [];

    if (overdue.hasData && overdue.data?.rows) {
      for (const item of overdue.data.rows.slice(0, 4)) {
        recommendations.push({
          kind: "call",
          score: 95,
          title: `Chiama ${item.companyName ?? "cliente"}`,
          reason: `Follow-up scaduto${item.scheduledAt ? ` dal ${new Date(item.scheduledAt).toLocaleDateString("it-IT")}` : ""}. Tempo stimato 10–15 min.`,
          companyId: item.companyId,
          companyName: item.companyName,
          estimatedMinutes: 12,
        });
      }
    }

    if (opps.hasData && opps.data?.rows) {
      for (const opp of opps.data.rows) {
        const idle = opp.idleDays ?? 0;
        // Heuristic: open + recent activity → higher win focus
        if (idle <= 7) {
          recommendations.push({
            kind: "high_win",
            score: 88 - idle,
            title: `Spingi chiusura: ${opp.title}`,
            reason: `Opportunità calda (${opp.stageLabel}, ${opp.totalAmount}, aggiornata ${idle}g fa). Investi 20–40 min oggi.`,
            companyId: opp.companyId,
            companyName: opp.companyName,
            estimatedMinutes: 30,
          });
        }
      }
    }

    if (stale.hasData && stale.data?.rows) {
      for (const opp of stale.data.rows.slice(0, 3)) {
        recommendations.push({
          kind: "deprioritize",
          score: 40,
          title: `Rivaluta: ${opp.title}`,
          reason: `Ferma da ${opp.idleDays ?? "?"} giorni (${opp.totalAmount}). Meglio una chiamata di sblocco o archiviare.`,
          companyId: opp.companyId,
          companyName: opp.companyName,
          estimatedMinutes: 10,
        });
      }
    }

    for (const row of inactiveClients.data ?? []) {
      const idle = daysSince(row.last_visit_at) ?? daysSince(row.updated_at) ?? 999;
      if (idle < 60) continue;
      recommendations.push({
        kind: idle >= 120 ? "churn_risk" : "neglected",
        score: idle >= 120 ? 90 : 70,
        title: `${idle >= 120 ? "Rischio churn" : "Cliente trascurato"}: ${row.name}`,
        reason: `Nessuna visita da ~${idle} giorni${row.city ? ` · ${row.city}` : ""}. Programma visita o chiamata di cura.`,
        companyId: row.id,
        companyName: row.name,
        estimatedMinutes: idle >= 120 ? 45 : 25,
      });
    }

    for (const row of (prospects.data ?? []).slice(0, 4)) {
      recommendations.push({
        kind: "prospect",
        score: 62,
        title: `Prospect da coltivare: ${row.name}`,
        reason: `Prospect attivo${row.city ? ` a ${row.city}` : ""}. Vale una visita di qualifica (~30 min) se sei nella zona.`,
        companyId: row.id,
        companyName: row.name,
        estimatedMinutes: 30,
      });
    }

    // Deduplicate by company+kind and sort by score
    const seen = new Set<string>();
    const ranked = recommendations
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const key = `${item.kind}:${item.companyId ?? item.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);

    if (ranked.length === 0) {
      return successToolResult({
        recommendations: [],
        summaryText:
          "Non ho abbastanza segnali CRM per un coaching strutturato. Popola visite, follow-up e opportunità.",
      });
    }

    const visitFirst = ranked.filter((r) =>
      ["visit", "churn_risk", "neglected", "prospect", "high_win"].includes(r.kind)
    );
    const callFirst = ranked.filter((r) => r.kind === "call");
    const totalMinutes = ranked.reduce((sum, r) => sum + (r.estimatedMinutes ?? 20), 0);

    const lines = [
      "**Coach commerciale** (ragionamento su dati CRM — nessuna azione automatica)",
      "",
      `Investimento consigliato oggi: ~**${totalMinutes} min** su ${ranked.length} priorità.`,
      callFirst.length > 0
        ? `\n**Da chiamare subito (${callFirst.length}):**\n${callFirst
            .map((r) => `• ${r.title} — ${r.reason}`)
            .join("\n")}`
        : null,
      visitFirst.length > 0
        ? `\n**Visite / focus (${visitFirst.length}):**\n${visitFirst
            .slice(0, 5)
            .map((r) => `• ${r.title} — ${r.reason}`)
            .join("\n")}`
        : null,
      ranked.some((r) => r.kind === "deprioritize")
        ? `\n**Da non inseguire oggi:**\n${ranked
            .filter((r) => r.kind === "deprioritize")
            .map((r) => `• ${r.title} — ${r.reason}`)
            .join("\n")}`
        : null,
      "",
      "Dimmi «organizza il giro», «briefing [cliente]» o «Joy registra…» per agire con conferma.",
    ].filter(Boolean);

    return successToolResult({
      recommendations: ranked,
      summaryText: lines.join("\n"),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Coach commerciale non disponibile."
    );
  }
}
