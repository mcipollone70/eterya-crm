import "server-only";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/types";
import type {
  VisitTourListFilters,
  VisitTourListItem,
  VisitTourSaveStatus,
} from "../types/visit-tour";
import { buildDefaultTourName } from "../utils/visit-tour-restore";

type VisitTourRow = {
  id: string;
  user_id: string;
  name: string | null;
  tour_date: string;
  mode: string;
  origin: Json;
  destination: Json;
  constraints: Json;
  stops: Json;
  total_distance_km: number | null;
  estimated_minutes: number | null;
  deviation_km: number | null;
  status: VisitTourSaveStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  users?: { full_name: string | null; email: string } | null;
};

function parseStopCount(stops: Json): number {
  return Array.isArray(stops) ? stops.length : 0;
}

function mapListItem(row: VisitTourRow): VisitTourListItem {
  const agentLabel =
    row.users?.full_name?.trim() || row.users?.email || "Agente sconosciuto";

  return {
    id: row.id,
    name: row.name?.trim() || buildDefaultTourName(row.tour_date, parseStopCount(row.stops)),
    tourDate: row.tour_date,
    userId: row.user_id,
    agentLabel,
    stopCount: parseStopCount(row.stops),
    totalDistanceKm: row.total_distance_km,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function revalidateVisitTourPaths() {
  revalidatePath("/routes");
}

export async function listVisitTourAgents(): Promise<{
  data: Array<{ id: string; label: string }>;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id,full_name,email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((user) => ({
      id: user.id,
      label: user.full_name?.trim() || user.email,
    })),
    error: null,
  };
}

export async function listVisitTours(filters: VisitTourListFilters = {}): Promise<{
  data: VisitTourListItem[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  let query = supabase
    .from("visit_tours")
    .select(
      "id,user_id,name,tour_date,mode,origin,destination,constraints,stops,total_distance_km,estimated_minutes,deviation_km,status,notes,created_at,updated_at,users(full_name,email)"
    );

  if (filters.tourDate) {
    query = query.eq("tour_date", filters.tourDate);
  }

  if (filters.agentId) {
    query = query.eq("user_id", filters.agentId);
  }

  const sortBy = filters.sortBy ?? "date";
  const ascending = filters.sortAscending ?? false;

  if (sortBy === "name") {
    query = query.order("name", { ascending, nullsFirst: false });
  } else {
    query = query.order("tour_date", { ascending }).order("updated_at", { ascending });
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  return {
    data: (data ?? []).map((row) => mapListItem(row as VisitTourRow)),
    error: null,
  };
}

export async function getVisitTourById(tourId: string): Promise<{
  data: VisitTourRow | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("visit_tours")
    .select(
      "id,user_id,name,tour_date,mode,origin,destination,constraints,stops,total_distance_km,estimated_minutes,deviation_km,status,notes,created_at,updated_at,users(full_name,email)"
    )
    .eq("id", tourId)
    .maybeSingle();

  if (error) {
    return { data: null, error: describeDbError(error) };
  }

  if (!data) {
    return { data: null, error: "Giro non trovato." };
  }

  return { data: data as VisitTourRow, error: null };
}

export async function renameVisitTour(
  tourId: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Sessione non valida." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, message: "Inserisci un nome per il giro." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("visit_tours")
    .update({ name: trimmed })
    .eq("id", tourId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Rinomina non riuscita." };
  }

  revalidateVisitTourPaths();
  return { success: true, message: "Giro rinominato." };
}

export async function duplicateVisitTour(
  tourId: string
): Promise<{ success: boolean; message: string; tourId?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Sessione non valida." };
  }

  const supabase = await createServerClient();
  const { data: source, error: fetchError } = await supabase
    .from("visit_tours")
    .select(
      "name,tour_date,mode,origin,destination,constraints,stops,total_distance_km,estimated_minutes,deviation_km,status,notes"
    )
    .eq("id", tourId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, message: describeDbError(fetchError) ?? "Duplicazione non riuscita." };
  }

  if (!source) {
    return { success: false, message: "Giro non trovato." };
  }

  const baseName = source.name?.trim() || buildDefaultTourName(source.tour_date, parseStopCount(source.stops));
  const copyName = `${baseName} (copia)`;

  const { data, error } = await supabase
    .from("visit_tours")
    .insert({
      user_id: user.id,
      name: copyName,
      tour_date: source.tour_date,
      mode: source.mode,
      origin: source.origin,
      destination: source.destination,
      constraints: source.constraints,
      stops: source.stops,
      total_distance_km: source.total_distance_km,
      estimated_minutes: source.estimated_minutes,
      deviation_km: source.deviation_km,
      status: "planned" as VisitTourSaveStatus,
      notes: source.notes,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Duplicazione non riuscita." };
  }

  revalidateVisitTourPaths();
  return {
    success: true,
    message: "Giro duplicato.",
    tourId: data.id,
  };
}

export async function deleteVisitTour(
  tourId: string
): Promise<{ success: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "Sessione non valida." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("visit_tours").delete().eq("id", tourId);

  if (error) {
    return { success: false, message: describeDbError(error) ?? "Eliminazione non riuscita." };
  }

  revalidateVisitTourPaths();
  return { success: true, message: "Giro eliminato." };
}

export type { VisitTourRow };
