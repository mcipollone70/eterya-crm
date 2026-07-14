import "server-only";

import { cache } from "react";
import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import { endOfTodayIso, startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";

export const countVisitsToday = cache(async (userId: string | null): Promise<number> => {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .or(
      `and(status.in.(scheduled,in_progress),scheduled_at.gte.${todayStart},scheduled_at.lte.${todayEnd}),and(status.eq.completed,completed_at.gte.${todayStart},completed_at.lte.${todayEnd})`
    );

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(describeDbError(error) ?? "Conteggio visite non riuscito.");
  }

  return count ?? 0;
});

export const estimateTodayTourKm = cache(async (userId: string | null): Promise<number> => {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();
  const todayEnd = endOfTodayIso();

  let query = supabase
    .from("visits")
    .select("scheduled_at,companies(latitude,longitude)")
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd)
    .order("scheduled_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return 0;
  }

  type VisitTourRow = {
    companies:
      | { latitude: number | null; longitude: number | null }
      | Array<{ latitude: number | null; longitude: number | null }>
      | null;
  };

  const points: Array<{ lat: number; lng: number }> = [];
  for (const row of data as VisitTourRow[]) {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    if (company?.latitude != null && company?.longitude != null) {
      points.push({ lat: company.latitude, lng: company.longitude });
    }
  }

  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += getDistanceKm(
      points[index - 1].lat,
      points[index - 1].lng,
      points[index].lat,
      points[index].lng
    );
  }

  return Math.round(total * 10) / 10;
});
