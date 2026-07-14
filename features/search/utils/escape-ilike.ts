/** Sanitizza input utente per filtri PostgREST `ilike`. */
export function escapeIlikePattern(value: string): string {
  const trimmed = value.trim().replace(/[%_,]/g, " ");
  if (!trimmed) {
    return "";
  }
  return `%${trimmed}%`;
}
