import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

/** Tabelle esportabili nel backup (ordine di ripristino: dipendenze prima). */
export const BACKUP_TABLES = [
  "users",
  "companies",
  "contacts",
  "products",
  "company_product_interests",
  "opportunities",
  "opportunity_products",
  "opportunity_stage_history",
  "follow_ups",
  "activities",
  "visits",
  "visit_tours",
  "agenda_reminders",
  "product_samples",
  "service_tickets",
  "attachments",
  "app_settings",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupSnapshot {
  meta: {
    generatedAt: string;
    appName: string;
    version: string;
    tables: string[];
  };
  data: Record<string, unknown[]>;
}

export interface BackupSummaryRow {
  table: string;
  count: number;
  error: string | null;
}

async function fetchTableRows(
  table: BackupTable
): Promise<{ rows: unknown[]; error: string | null }> {
  const supabase = await createServerClient();
  const rows: unknown[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + batchSize - 1);

    if (error) {
      // Tabella non presente (migrazione non applicata): salta senza fallire.
      if (/relation .* does not exist|does not exist/i.test(error.message)) {
        return { rows, error: null };
      }
      return { rows, error: error.message };
    }

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < batchSize) {
      break;
    }
    offset += batchSize;
  }

  return { rows, error: null };
}

export async function buildBackupSnapshot(): Promise<{
  snapshot: BackupSnapshot;
  summary: BackupSummaryRow[];
}> {
  const data: Record<string, unknown[]> = {};
  const summary: BackupSummaryRow[] = [];

  for (const table of BACKUP_TABLES) {
    const { rows, error } = await fetchTableRows(table);
    data[table] = rows;
    summary.push({ table, count: rows.length, error });
  }

  const snapshot: BackupSnapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      appName: "Eterya CRM",
      version: "1.0",
      tables: [...BACKUP_TABLES],
    },
    data,
  };

  return { snapshot, summary };
}

export async function getBackupSummary(): Promise<BackupSummaryRow[]> {
  const supabase = await createServerClient();
  const summary: BackupSummaryRow[] = [];

  for (const table of BACKUP_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });

    if (error && /relation .* does not exist|does not exist/i.test(error.message)) {
      summary.push({ table, count: 0, error: "tabella assente" });
      continue;
    }

    summary.push({ table, count: count ?? 0, error: error ? error.message : null });
  }

  return summary;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object");
}

/**
 * Ripristino NON distruttivo: inserisce solo le righe mancanti (per id), senza
 * aggiornare o eliminare dati esistenti. Le righe con id già presente vengono
 * ignorate. Restituisce un riepilogo per tabella.
 */
export async function restoreBackupSnapshot(
  snapshot: unknown
): Promise<{ summary: BackupSummaryRow[]; error: string | null }> {
  if (!snapshot || typeof snapshot !== "object") {
    return { summary: [], error: "File di backup non valido." };
  }

  const parsed = snapshot as Partial<BackupSnapshot>;
  if (!parsed.data || typeof parsed.data !== "object") {
    return { summary: [], error: "Struttura del backup non riconosciuta." };
  }

  // Client non tipizzato: i nomi tabella sono dinamici, quindi bypassiamo il
  // tipo Database generato per l'upsert generico riga-per-tabella.
  const supabase = (await createServerClient()) as unknown as SupabaseClient;
  const summary: BackupSummaryRow[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = parsed.data[table];
    if (!isRecordArray(rows) || rows.length === 0) {
      continue;
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
      .select("id");

    summary.push({
      table,
      count: data?.length ?? 0,
      error: error ? error.message : null,
    });
  }

  return { summary, error: null };
}
