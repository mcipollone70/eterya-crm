import "server-only";

import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { Json } from "@/lib/supabase/types";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  query?: string;
}

export interface LogAuditEventInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra un evento di audit. Non solleva mai: il logging non deve mai
 * compromettere l'operazione principale. Se la tabella non esiste (migrazione
 * non applicata) l'errore viene ignorato silenziosamente.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentUserProfile()]);
    const supabase = await createServerClient();

    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      actor_email: profile?.email ?? user?.email ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });
  } catch {
    // no-op: audit non deve mai bloccare il flusso principale
  }
}

export async function listAuditLogs(
  filters?: AuditLogFilters,
  limit = 200
): Promise<{ data: AuditLogEntry[]; count: number; error: string | null }> {
  const supabase = await createServerClient();

  let query = supabase
    .from("audit_logs")
    .select("id,user_id,actor_email,action,entity_type,entity_id,summary,created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.query) {
    query = query.ilike("summary", `%${filters.query}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    if (/audit_logs|relation .* does not exist/i.test(error.message)) {
      return {
        data: [],
        count: 0,
        error: "Tabella audit non trovata. Esegui la migrazione 20260715_audit_logs.sql su Supabase.",
      };
    }
    return { data: [], count: 0, error: describeDbError(error) };
  }

  const items: AuditLogEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    createdAt: row.created_at,
  }));

  return { data: items, count: count ?? items.length, error: null };
}
