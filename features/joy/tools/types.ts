import { isMissingTableError as isMissingRelationError } from "@/lib/supabase/errors";
import type { PostgrestError } from "@supabase/supabase-js";

export interface JoyToolResult<T> {
  data: T;
  error: string | null;
  /** `true` when the tool returned usable CRM data. */
  hasData: boolean;
}

export function isMissingTableError(error: PostgrestError | null): boolean {
  return isMissingRelationError(error);
}

export function emptyToolResult<T>(fallback: T, error: string | null = null): JoyToolResult<T> {
  return { data: fallback, error, hasData: false };
}

export function successToolResult<T>(data: T): JoyToolResult<T> {
  return { data, error: null, hasData: true };
}
