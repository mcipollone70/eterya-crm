import "server-only";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { fetchPriorityContext } from "@/features/companies/services/commercial-priority.service";
import { getFollowUpEffectiveDate } from "@/lib/constants/follow-up";
import { startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/types";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";
import type {
  GeoPoint,
  VisitTourConstraints,
  VisitTourOptimizeStop,
  VisitTourSaveStatus,
} from "../types/visit-tour";
import { buildDefaultTourName } from "../utils/visit-tour-restore";
import { isMissingVisitTourNameColumn } from "./visit-tour-db-compat";

export interface SaveVisitTourInput {
  tourId?: string | null;
  name?: string | null;
  tourDate: string;
  mode?: "corridor" | "optimize";
  origin: GeoPoint & { label: string; companyId?: string };
  destination: GeoPoint & { label: string; companyId?: string };
  constraints: VisitTourConstraints;
  stops: VisitTourOptimizeStop[];
  totalDistanceKm: number;
  estimatedMinutes: number;
  deviationKm: number;
  status?: VisitTourSaveStatus;
  notes?: string | null;
}

export const fetchVisitTourOptimizeContext = cache(async (): Promise<VisitTourOptimizeContext> => {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();

  const [priorityContext, visitsRes, followUpsRes] = await Promise.all([
    fetchPriorityContext(),
    supabase
      .from("visits")
      .select("company_id,completed_at,status")
      .eq("status", "completed")
      .gte("completed_at", todayStart),
    supabase
      .from("follow_ups")
      .select("company_id,status,scheduled_at,postponed_to,completed_at")
      .in("status", ["todo", "postponed"]),
  ]);

  const visitedTodayCompanyIds = new Set<string>();
  for (const visit of visitsRes.data ?? []) {
    if (visit.company_id) {
      visitedTodayCompanyIds.add(visit.company_id);
    }
  }

  const overdueFollowUpCompanyIds = new Set<string>();
  for (const followUp of followUpsRes.data ?? []) {
    if (!followUp.company_id || followUp.completed_at) {
      continue;
    }

    const effectiveAt = getFollowUpEffectiveDate({
      status: followUp.status,
      scheduled_at: followUp.scheduled_at,
      postponed_to: followUp.postponed_to,
    });

    if (new Date(effectiveAt).getTime() < new Date(todayStart).getTime()) {
      overdueFollowUpCompanyIds.add(followUp.company_id);
    }
  }

  return {
    ...priorityContext,
    visitedTodayCompanyIds: [...visitedTodayCompanyIds],
    overdueFollowUpCompanyIds: [...overdueFollowUpCompanyIds],
  };
});

export async function saveVisitTour(
  input: SaveVisitTourInput
): Promise<{ success: boolean; message: string; tourId?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Sessione non valida." };
  }

  const supabase = await createServerClient();

  const stopsPayload = input.stops.map((stop) => ({
    id: stop.id,
    order: stop.order,
    locked: stop.locked,
    score: stop.score,
    reason: stop.reason,
    deviationKm: stop.deviationKm,
    legDistanceKm: stop.legDistanceKm,
    detourKm: stop.detourKm,
    companyId: stop.company.id,
    companyName: stop.company.name,
    // Persist coords in JSON (no schema change) so mobile can open Google Maps
    // without an async company refetch before the user tap.
    latitude: stop.company.latitude,
    longitude: stop.company.longitude,
  }));

  const tourName =
    input.name?.trim() ||
    buildDefaultTourName(input.tourDate, input.stops.length);

  const rowPayload = {
    user_id: user.id,
    name: tourName,
    tour_date: input.tourDate,
    mode: input.mode ?? "optimize",
    origin: input.origin as unknown as Json,
    destination: input.destination as unknown as Json,
    constraints: input.constraints as unknown as Json,
    stops: stopsPayload as unknown as Json,
    total_distance_km: input.totalDistanceKm,
    estimated_minutes: input.estimatedMinutes,
    deviation_km: input.deviationKm,
    status: input.status ?? "planned",
    notes: input.notes ?? null,
  };

  const { name: omittedTourName, ...rowPayloadWithoutName } = rowPayload;
  void omittedTourName;

  async function persistTour(
    payload: typeof rowPayload | typeof rowPayloadWithoutName,
    tourId?: string | null
  ) {
    if (tourId) {
      return supabase.from("visit_tours").update(payload).eq("id", tourId).select("id").single();
    }

    return supabase.from("visit_tours").insert(payload).select("id").single();
  }

  let { data, error } = await persistTour(rowPayload, input.tourId);

  if (error && isMissingVisitTourNameColumn(error)) {
    ({ data, error } = await persistTour(rowPayloadWithoutName, input.tourId));
  }

  if (error) {
    return {
      success: false,
      message: describeDbError(error) ?? (input.tourId ? "Aggiornamento non riuscito." : "Salvataggio non riuscito."),
    };
  }

  if (!data) {
    return {
      success: false,
      message: input.tourId ? "Aggiornamento non riuscito." : "Salvataggio non riuscito.",
    };
  }

  revalidatePath("/giro-visite");
  revalidatePath("/routes");

  return {
    success: true,
    message: input.tourId ? "Giro visite aggiornato." : "Giro visite salvato.",
    tourId: data.id,
  };
}
