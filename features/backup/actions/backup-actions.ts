"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logAuditEvent } from "@/features/audit/services/audit-log.service";
import {
  isAdminActionError,
  requireAdminProfile,
} from "@/features/admin/services/admin-auth.service";
import {
  buildBackupSnapshot,
  restoreBackupSnapshot,
  type BackupSummaryRow,
} from "../services/backup.service";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi le variabili Supabase in .env.local.";

async function guardAdmin(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return NOT_CONFIGURED_MESSAGE;
  }
  const profile = await requireAdminProfile();
  if (isAdminActionError(profile)) {
    return profile.error ?? "Accesso riservato agli amministratori.";
  }
  return null;
}

export async function generateBackupAction(): Promise<{
  success: boolean;
  message: string;
  fileName?: string;
  content?: string;
  summary?: BackupSummaryRow[];
}> {
  const denied = await guardAdmin();
  if (denied) {
    return { success: false, message: denied };
  }

  const { snapshot, summary } = await buildBackupSnapshot();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const totalRecords = summary.reduce((sum, row) => sum + row.count, 0);

  await logAuditEvent({
    action: "backup_export",
    entityType: "backup",
    summary: `Backup esportato · ${totalRecords} record`,
  });

  return {
    success: true,
    message: `Backup generato: ${totalRecords.toLocaleString("it-IT")} record.`,
    fileName: `eterya-backup-${stamp}.json`,
    content: JSON.stringify(snapshot, null, 2),
    summary,
  };
}

export async function restoreBackupAction(
  fileContent: string
): Promise<{ success: boolean; message: string; summary?: BackupSummaryRow[] }> {
  const denied = await guardAdmin();
  if (denied) {
    return { success: false, message: denied };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    return { success: false, message: "Il file selezionato non è un JSON valido." };
  }

  const { summary, error } = await restoreBackupSnapshot(parsed);
  if (error) {
    return { success: false, message: error };
  }

  const restored = summary.reduce((sum, row) => sum + row.count, 0);

  await logAuditEvent({
    action: "backup_restore",
    entityType: "backup",
    summary: `Ripristino backup · ${restored} record inseriti`,
  });

  revalidatePath("/");

  return {
    success: true,
    message: `Ripristino completato: ${restored.toLocaleString("it-IT")} record inseriti (i duplicati sono stati ignorati).`,
    summary,
  };
}
