/** Audit module — registro azioni chiave. */
export const AUDIT_MODULE = "audit" as const;

export { AuditLogPage } from "./audit-log-page";
export {
  logAuditEvent,
  listAuditLogs,
  type AuditLogEntry,
  type LogAuditEventInput,
} from "./services/audit-log.service";
