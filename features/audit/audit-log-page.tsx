import { History } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  auditActionVariant,
  getAuditActionLabel,
  getAuditEntityLabel,
} from "@/lib/constants/audit";
import { listAuditLogs } from "./services/audit-log.service";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function AuditLogPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" subtitle="Registro delle azioni chiave del CRM." />
        <EmptyState
          icon={History}
          title="Database non configurato"
          message="Configura Supabase in .env.local per consultare l'audit log."
        />
      </div>
    );
  }

  const { data: logs, count, error } = await listAuditLogs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${count.toLocaleString("it-IT")} eventi registrati`}
      />

      {error ? (
        <EmptyState icon={History} title="Registro non disponibile" message={error} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nessun evento registrato"
          message="Le azioni rilevanti (utenti, configurazione, backup) verranno tracciate qui."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Data</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Azione</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Entità</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Dettaglio</th>
                <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
                  Autore
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={auditActionVariant(log.action)}>
                      {getAuditActionLabel(log.action)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {getAuditEntityLabel(log.entityType)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.summary ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {log.actorEmail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
