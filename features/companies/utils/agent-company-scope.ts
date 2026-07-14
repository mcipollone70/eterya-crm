/** Limita la query alle aziende assegnate all'agente autenticato. */
export function applyAgentCompanyScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  agentId: string | null | undefined
): T {
  if (!agentId) {
    return query;
  }

  return query.eq("assigned_user_id", agentId);
}

/** Route da rivalidare dopo un import aziende per aggiornare dashboard e moduli AI. */
export const COMPANY_IMPORT_REVALIDATE_PATHS = [
  "/companies",
  "/",
  "/command-center",
  "/assistant",
  "/joy",
  "/joy/chat",
  "/joy/autonomous",
  "/maps",
  "/routes",
  "/auto",
] as const;
