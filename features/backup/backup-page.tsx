import { DatabaseBackup } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBackupSummary } from "./services/backup.service";
import { BackupScreen } from "./components/backup-screen";

export async function BackupPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Backup e Ripristino" subtitle="Esporta e ripristina i dati del CRM." />
        <EmptyState
          icon={DatabaseBackup}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare backup e ripristino."
        />
      </div>
    );
  }

  const summary = await getBackupSummary();
  const total = summary.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup e Ripristino"
        subtitle={`${total.toLocaleString("it-IT")} record nel database · esportazione JSON completa`}
      />
      <BackupScreen />
    </div>
  );
}
