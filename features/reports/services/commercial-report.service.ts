import "server-only";

import { cache } from "react";
import { getCommercialKpiData } from "@/features/dashboard/services/commercial-kpi.service";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import { CLOSED_LOST_STAGE, CLOSED_WON_STAGE } from "@/lib/constants/opportunity-pipeline";
import type { CommercialKpiData } from "@/features/dashboard/types/commercial-kpi";

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  value: number;
  conversionFromPrevious: number | null;
}

export interface MonthlyPoint {
  label: string;
  value: number;
}

export interface AdvancedStatistics {
  ordersMonthlyValue: MonthlyPoint[];
  wonMonthlyCount: MonthlyPoint[];
  lostMonthlyCount: MonthlyPoint[];
  averageDealSize: number;
  winRate: number;
  totalWon: number;
  totalLost: number;
  error: string | null;
}

const MONTH_LABELS = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function monthKey(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

function safeAmount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseClosedDate(...candidates: unknown[]): Date | null {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const date = candidate instanceof Date ? candidate : new Date(String(candidate));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function buildRecentMonths(count: number): Array<{ key: string; label: string }> {
  const months: Array<{ key: string; label: string }> = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = monthKey(date);
    if (key) {
      months.push({ key, label: monthLabel(date) });
    }
  }

  return months;
}

export const getCommercialFunnel = cache(async (): Promise<{
  steps: FunnelStep[];
  kpi: CommercialKpiData;
}> => {
  const kpi = await getCommercialKpiData();

  const openStepCount = kpi.openOpportunities;
  const quotesSent = kpi.quotesSent + kpi.quotesAccepted;
  const quotesAccepted = kpi.quotesAccepted;
  const orders = kpi.ordersCount;

  function conversion(current: number, previous: number): number | null {
    if (previous <= 0) {
      return null;
    }
    return Math.round((current / previous) * 100);
  }

  const steps: FunnelStep[] = [
    {
      key: "open",
      label: "Opportunità aperte",
      count: openStepCount,
      value: kpi.pipelineValue,
      conversionFromPrevious: null,
    },
    {
      key: "quotes_sent",
      label: "Preventivi inviati",
      count: quotesSent,
      value: kpi.quotesSentValue,
      conversionFromPrevious: conversion(quotesSent, openStepCount),
    },
    {
      key: "quotes_accepted",
      label: "Preventivi accettati",
      count: quotesAccepted,
      value: kpi.quotesAcceptedValue,
      conversionFromPrevious: conversion(quotesAccepted, quotesSent),
    },
    {
      key: "orders",
      label: "Ordini",
      count: orders,
      value: kpi.ordersValue,
      conversionFromPrevious: conversion(orders, quotesAccepted),
    },
  ];

  return { steps, kpi };
});

export const getAdvancedStatistics = cache(async (): Promise<AdvancedStatistics> => {
  const months = buildRecentMonths(6);
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 5);
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("opportunities")
    .select("total_amount,stage,created_at,accepted_at,updated_at,order_status")
    .limit(5000);

  if (error) {
    // Fallback if order_status column missing (pre-migration)
    if (error.message?.includes("order_status") || error.code === "42703") {
      const legacy = await supabase
        .from("opportunities")
        .select("total_amount,stage,created_at,accepted_at,updated_at,status")
        .eq("stage", CLOSED_WON_STAGE)
        .limit(5000);
      // Without order_status, prefer rows with status=accepted as orders proxy
      if (!legacy.error) {
        const ordersValueByMonth = new Map<string, number>();
        const wonByMonth = new Map<string, number>();
        let totalWon = 0;
        let wonValueSum = 0;
        for (const row of legacy.data ?? []) {
          if ((row as { status?: string }).status !== "accepted") continue;
          const amount = safeAmount(row.total_amount);
          totalWon += 1;
          wonValueSum += amount;
          const closedDate = parseClosedDate(row.accepted_at, row.updated_at, row.created_at);
          const key = closedDate ? monthKey(closedDate) : null;
          if (key) {
            ordersValueByMonth.set(key, (ordersValueByMonth.get(key) ?? 0) + amount);
            wonByMonth.set(key, (wonByMonth.get(key) ?? 0) + 1);
          }
        }
        const lost = await supabase
          .from("opportunities")
          .select("updated_at,created_at")
          .eq("stage", CLOSED_LOST_STAGE)
          .limit(5000);
        const lostByMonth = new Map<string, number>();
        let totalLost = 0;
        for (const row of lost.data ?? []) {
          totalLost += 1;
          const closedDate = parseClosedDate(row.updated_at, row.created_at);
          const key = closedDate ? monthKey(closedDate) : null;
          if (key) {
            lostByMonth.set(key, (lostByMonth.get(key) ?? 0) + 1);
          }
        }
        const closedTotal = totalWon + totalLost;
        return {
          ordersMonthlyValue: months.map((m) => ({
            label: m.label,
            value: ordersValueByMonth.get(m.key) ?? 0,
          })),
          wonMonthlyCount: months.map((m) => ({
            label: m.label,
            value: wonByMonth.get(m.key) ?? 0,
          })),
          lostMonthlyCount: months.map((m) => ({
            label: m.label,
            value: lostByMonth.get(m.key) ?? 0,
          })),
          averageDealSize: totalWon > 0 ? Math.round(wonValueSum / totalWon) : 0,
          winRate: closedTotal > 0 ? Math.round((totalWon / closedTotal) * 100) : 0,
          totalWon,
          totalLost,
          error: null,
        };
      }
    }
    return {
      ordersMonthlyValue: months.map((m) => ({ label: m.label, value: 0 })),
      wonMonthlyCount: months.map((m) => ({ label: m.label, value: 0 })),
      lostMonthlyCount: months.map((m) => ({ label: m.label, value: 0 })),
      averageDealSize: 0,
      winRate: 0,
      totalWon: 0,
      totalLost: 0,
      error: describeDbError(error),
    };
  }

  const ordersValueByMonth = new Map<string, number>();
  const wonByMonth = new Map<string, number>();
  const lostByMonth = new Map<string, number>();

  let totalWon = 0;
  let totalLost = 0;
  let wonValueSum = 0;

  for (const row of data ?? []) {
    const amount = safeAmount(row.total_amount);
    const stage = row.stage;
    // Count only real orders (stage=won + order_status set). Accepted quotes
    // stay stage=won without order_status and must not inflate order stats.
    const isRealOrder = stage === CLOSED_WON_STAGE && row.order_status != null;

    if (isRealOrder) {
      totalWon += 1;
      wonValueSum += amount;
      const closedDate = parseClosedDate(row.accepted_at, row.updated_at, row.created_at);
      const key = closedDate ? monthKey(closedDate) : null;
      if (key) {
        ordersValueByMonth.set(key, (ordersValueByMonth.get(key) ?? 0) + amount);
        wonByMonth.set(key, (wonByMonth.get(key) ?? 0) + 1);
      }
    } else if (stage === CLOSED_LOST_STAGE) {
      totalLost += 1;
      const closedDate = parseClosedDate(row.updated_at, row.created_at);
      const key = closedDate ? monthKey(closedDate) : null;
      if (key) {
        lostByMonth.set(key, (lostByMonth.get(key) ?? 0) + 1);
      }
    }
  }

  const closedTotal = totalWon + totalLost;

  return {
    ordersMonthlyValue: months.map((m) => ({
      label: m.label,
      value: ordersValueByMonth.get(m.key) ?? 0,
    })),
    wonMonthlyCount: months.map((m) => ({
      label: m.label,
      value: wonByMonth.get(m.key) ?? 0,
    })),
    lostMonthlyCount: months.map((m) => ({
      label: m.label,
      value: lostByMonth.get(m.key) ?? 0,
    })),
    averageDealSize: totalWon > 0 ? Math.round(wonValueSum / totalWon) : 0,
    winRate: closedTotal > 0 ? Math.round((totalWon / closedTotal) * 100) : 0,
    totalWon,
    totalLost,
    error: null,
  };
});
