export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Creazione",
  update: "Modifica",
  delete: "Eliminazione",
  deactivate: "Disattivazione",
  invite: "Invito",
  password_reset: "Reset password",
  backup_export: "Backup esportato",
  backup_restore: "Ripristino backup",
  config_update: "Configurazione aggiornata",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  user: "Utente",
  company: "Azienda",
  opportunity: "Opportunità",
  quote: "Preventivo",
  order: "Ordine",
  sample: "Campione",
  service_ticket: "Ticket assistenza",
  document: "Documento",
  backup: "Backup",
  app_settings: "Configurazione",
};

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function getAuditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

export function auditActionVariant(
  action: string
): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  if (action === "create" || action === "invite") {
    return "success";
  }
  if (action === "delete" || action === "deactivate") {
    return "danger";
  }
  if (action === "update" || action === "config_update") {
    return "info";
  }
  if (action === "backup_export" || action === "backup_restore") {
    return "warning";
  }
  return "muted";
}
