import type { PostgrestError } from "@supabase/supabase-js";

export const VISIT_TOUR_NAME_MIGRATION_HINT =
  "Esegui supabase/migrations/20260715_visit_tours_name.sql nel SQL Editor di Supabase per abilitare nome e rinomina giri.";

export const VISIT_TOUR_ROW_SELECT_BASE =
  "id,user_id,tour_date,mode,origin,destination,constraints,stops,total_distance_km,estimated_minutes,deviation_km,status,notes,created_at,updated_at";

export const VISIT_TOUR_ROW_SELECT_WITH_NAME = `name,${VISIT_TOUR_ROW_SELECT_BASE}`;

export const VISIT_TOUR_ROW_SELECT_WITH_AGENT = `${VISIT_TOUR_ROW_SELECT_WITH_NAME},users(full_name,email)`;

export const VISIT_TOUR_ROW_SELECT_WITH_AGENT_NO_NAME = `${VISIT_TOUR_ROW_SELECT_BASE},users(full_name,email)`;

export function isMissingVisitTourNameColumn(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "42703" &&
    (/visit_tours\.name/i.test(error.message) ||
      (/column/i.test(error.message) && /\bname\b/i.test(error.message)))
  );
}
