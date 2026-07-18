/**
 * Agent learning from REAL CRM aggregates only.
 * Honest "insufficient data" when sample sizes are too small.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { applyAgentCompanyScope } from "@/features/companies/utils/agent-company-scope";
import { JOY_INSUFFICIENT_DATA_MESSAGE } from "@/features/joy/tools";
import type { JoyAgentLearningSnapshot } from "../types";

const MIN_VISITS = 5;
const MIN_OPPS = 5;
const MIN_FOLLOWUPS = 5;

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function buildJoyAgentLearning(
  userId: string | null
): Promise<JoyAgentLearningSnapshot> {
  const supabase = await createServerClient();

  let visitsQuery = supabase
    .from("visits")
    .select("id,status,scheduled_at,completed_at,duration_minutes,company_id")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(120);
  if (userId) visitsQuery = visitsQuery.eq("user_id", userId);

  let wonQuery = supabase
    .from("opportunities")
    .select("id,total_amount,stage,accepted_at,created_at")
    .eq("stage", "won")
    .limit(80);
  if (userId) wonQuery = wonQuery.eq("user_id", userId);

  let lostQuery = supabase
    .from("opportunities")
    .select("id,total_amount,stage,updated_at,created_at")
    .eq("stage", "lost")
    .limit(80);
  if (userId) lostQuery = lostQuery.eq("user_id", userId);

  let fuQuery = supabase
    .from("follow_ups")
    .select("id,status,scheduled_at,completed_at,priority")
    .in("status", ["completed", "todo", "postponed", "cancelled"])
    .limit(120);
  if (userId) fuQuery = fuQuery.eq("user_id", userId);

  const interestsQuery = supabase
    .from("company_product_interests")
    .select("company_id,products(family)")
    .limit(200);

  const [visitsRes, wonRes, lostRes, fuRes, interestsRes] = await Promise.all([
    visitsQuery,
    wonQuery,
    lostQuery,
    fuQuery,
    interestsQuery,
  ]);

  const visits = visitsRes.data ?? [];
  const won = wonRes.data ?? [];
  const lost = lostRes.data ?? [];
  const followUps = fuRes.data ?? [];
  const interests = interestsRes.data ?? [];

  const durations = visits
    .map((row) => Number(row.duration_minutes))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 480);
  const avgDuration = avg(durations);

  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;
  const avgWon = avg(
    won.map((row) => Number(row.total_amount) || 0).filter((n) => n > 0)
  );

  const fuDone = followUps.filter((row) => row.status === "completed").length;
  const fuOpen = followUps.filter(
    (row) => row.status === "todo" || row.status === "postponed"
  ).length;
  const fuSuccessRate =
    fuDone + fuOpen > 0 ? Math.round((fuDone / (fuDone + fuOpen)) * 100) : null;

  const familyCounts = new Map<string, number>();
  for (const row of interests) {
    const products = row.products;
    const product = Array.isArray(products) ? products[0] : products;
    const family = String(
      (product as { family?: string } | null)?.family ?? "altro"
    );
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }
  const topFamilies = [...familyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  let companiesQuery = supabase
    .from("companies")
    .select("id,city,commercial_status,last_visit_at")
    .eq("commercial_status", "cliente")
    .limit(150);
  if (userId) {
    companiesQuery = applyAgentCompanyScope(companiesQuery, userId);
  }
  const { data: companies } = await companiesQuery;
  const cityIdle = new Map<string, number>();
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  for (const row of companies ?? []) {
    const city = (row.city ?? "").trim();
    if (!city) continue;
    const last = row.last_visit_at ? new Date(row.last_visit_at).getTime() : null;
    if (last == null || last < yearAgo) {
      cityIdle.set(city, (cityIdle.get(city) ?? 0) + 1);
    }
  }
  const neglectedCities = [...cityIdle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const patterns: JoyAgentLearningSnapshot["patterns"] = [];

  if (durations.length >= MIN_VISITS && avgDuration != null) {
    patterns.push({
      id: "visit-duration",
      label: "Durata visite",
      finding: `Durata media visite completate: **${Math.round(avgDuration)} min** (n=${durations.length}).`,
      confidence: durations.length >= 20 ? "high" : "medium",
    });
  } else {
    patterns.push({
      id: "visit-duration",
      label: "Durata visite",
      finding: JOY_INSUFFICIENT_DATA_MESSAGE,
      confidence: "insufficient",
    });
  }

  if (closed >= MIN_OPPS && winRate != null) {
    patterns.push({
      id: "win-loss",
      label: "Win / loss",
      finding: `Su ${closed} opportunità chiuse: win rate **${winRate}%**${
        avgWon != null && avgWon > 0
          ? ` · ticket medio won ~${Math.round(avgWon).toLocaleString("it-IT")} €`
          : ""
      }.`,
      confidence: closed >= 20 ? "high" : "medium",
    });
  } else {
    patterns.push({
      id: "win-loss",
      label: "Win / loss",
      finding: JOY_INSUFFICIENT_DATA_MESSAGE,
      confidence: "insufficient",
    });
  }

  if (fuDone + fuOpen >= MIN_FOLLOWUPS && fuSuccessRate != null) {
    patterns.push({
      id: "follow-up-success",
      label: "Follow-up",
      finding: `Nel campione: **${fuSuccessRate}%** follow-up completati (${fuDone} done / ${fuOpen} aperti).`,
      confidence: fuDone + fuOpen >= 20 ? "high" : "medium",
    });
  } else {
    patterns.push({
      id: "follow-up-success",
      label: "Follow-up",
      finding: JOY_INSUFFICIENT_DATA_MESSAGE,
      confidence: "insufficient",
    });
  }

  if (topFamilies.length > 0) {
    patterns.push({
      id: "product-mix",
      label: "Prodotti in interesse",
      finding: `Mix interessi CRM: ${topFamilies
        .map(([family, count]) => `${family} (${count})`)
        .join(", ")}.`,
      confidence: interests.length >= 15 ? "medium" : "low",
    });
  } else {
    patterns.push({
      id: "product-mix",
      label: "Prodotti in interesse",
      finding: JOY_INSUFFICIENT_DATA_MESSAGE,
      confidence: "insufficient",
    });
  }

  if (neglectedCities.length > 0) {
    patterns.push({
      id: "neglected-zones",
      label: "Zone trascurate",
      finding: `Clienti inattivi concentrati in: ${neglectedCities
        .map(([city, count]) => `${city} (${count})`)
        .join(", ")}.`,
      confidence: "medium",
    });
  }

  const strengths: string[] = [];
  const inefficiencies: string[] = [];

  if (winRate != null && winRate >= 40 && closed >= MIN_OPPS) {
    strengths.push(`Win rate ${winRate}% su opportunità chiuse (campione CRM).`);
  }
  if (fuSuccessRate != null && fuSuccessRate >= 50) {
    strengths.push(`Buona chiusura follow-up (${fuSuccessRate}% nel campione).`);
  }
  if (avgDuration != null && avgDuration >= 20 && avgDuration <= 60) {
    strengths.push(
      `Durata visite nella fascia operativa ${Math.round(avgDuration)} min.`
    );
  }

  if (winRate != null && winRate < 25 && closed >= MIN_OPPS) {
    inefficiencies.push(
      `Win rate basso (${winRate}%): rivedi qualifica e follow-up post-preventivo.`
    );
  }
  if (fuOpen > fuDone && fuDone + fuOpen >= MIN_FOLLOWUPS) {
    inefficiencies.push(
      `Più follow-up aperti (${fuOpen}) che chiusi (${fuDone}) nel campione.`
    );
  }
  if (neglectedCities[0]) {
    inefficiencies.push(
      `Zona ${neglectedCities[0][0]} con ${neglectedCities[0][1]} clienti inattivi — densifica il giro.`
    );
  }
  if (
    topFamilies[0] &&
    topFamilies.length >= 2 &&
    topFamilies[0][1] > topFamilies[1][1] * 3
  ) {
    inefficiencies.push(
      `Mix prodotti sbilanciato su ${topFamilies[0][0]}: valuta spinta sulle altre famiglie con interesse CRM.`
    );
  }

  if (strengths.length === 0 && patterns.every((p) => p.confidence === "insufficient")) {
    strengths.push(
      "Ancora troppo pochi dati aggregati per evidenziare punti di forza."
    );
  }
  if (
    inefficiencies.length === 0 &&
    patterns.some((p) => p.confidence !== "insufficient")
  ) {
    inefficiencies.push(
      "Nessuna inefficienza evidente sul campione attuale — continua a registrare visite ed esiti."
    );
  }

  const usable = patterns.filter((p) => p.confidence !== "insufficient");
  const summaryText = [
    "**Apprendimento agente (solo aggregati CRM reali)**",
    "",
    ...patterns.map((p) => `• **${p.label}**: ${p.finding}`),
    "",
    strengths.length
      ? `**Punti di forza:**\n${strengths.map((s) => `• ${s}`).join("\n")}`
      : "",
    inefficiencies.length
      ? `**Inefficienze / focus:**\n${inefficiencies.map((s) => `• ${s}`).join("\n")}`
      : "",
    "",
    usable.length === 0
      ? `_${JOY_INSUFFICIENT_DATA_MESSAGE}_`
      : "_Stime descrittive sul passato CRM — nessuna previsione di vendita._",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sampleSize: {
      completedVisits: visits.length,
      wonOpportunities: won.length,
      lostOpportunities: lost.length,
      followUpsClosed: fuDone,
    },
    patterns,
    strengths,
    inefficiencies,
    summaryText,
  };
}
