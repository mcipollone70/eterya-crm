import type { UserRole } from "@/lib/supabase/types";
import { USER_ROLE_LABELS } from "@/features/admin/constants/user-roles";

export interface PermissionArea {
  key: string;
  label: string;
  description: string;
  /** Ruoli che dispongono della capacità in questa area. */
  roles: UserRole[];
}

const ALL_OPERATIONAL: UserRole[] = ["super_admin", "org_admin", "manager", "agent"];
const ALL_WITH_VIEWER: UserRole[] = [
  "super_admin",
  "org_admin",
  "manager",
  "agent",
  "viewer",
];
const ADMINS: UserRole[] = ["super_admin", "org_admin"];
const ADMINS_AND_MANAGER: UserRole[] = ["super_admin", "org_admin", "manager"];

export const PERMISSION_AREAS: PermissionArea[] = [
  {
    key: "view_crm",
    label: "Consultazione CRM",
    description: "Accesso in lettura ad aziende, contatti, agenda e dashboard.",
    roles: ALL_WITH_VIEWER,
  },
  {
    key: "manage_companies",
    label: "Gestione aziende e contatti",
    description: "Creazione e modifica di aziende, contatti e attività.",
    roles: ALL_OPERATIONAL,
  },
  {
    key: "manage_pipeline",
    label: "Pipeline, preventivi e ordini",
    description: "Gestione opportunità, preventivi, ordini e campioni.",
    roles: ALL_OPERATIONAL,
  },
  {
    key: "manage_service",
    label: "Assistenza post-vendita",
    description: "Apertura e gestione dei ticket di assistenza.",
    roles: ALL_OPERATIONAL,
  },
  {
    key: "view_reports",
    label: "Report e statistiche",
    description: "Accesso a report commerciali, KPI e statistiche avanzate.",
    roles: ADMINS_AND_MANAGER,
  },
  {
    key: "manage_documents",
    label: "Gestione documenti",
    description: "Caricamento ed eliminazione di documenti e allegati.",
    roles: ALL_OPERATIONAL,
  },
  {
    key: "manage_users",
    label: "Gestione utenti",
    description: "Creazione, modifica e disattivazione degli account utente.",
    roles: ADMINS,
  },
  {
    key: "manage_config",
    label: "Configurazione azienda",
    description: "Modifica dei dati aziendali e dei default operativi.",
    roles: ADMINS,
  },
  {
    key: "backup_restore",
    label: "Backup e ripristino",
    description: "Esportazione e ripristino dei dati del CRM.",
    roles: ADMINS,
  },
  {
    key: "view_audit",
    label: "Audit log",
    description: "Consultazione del registro delle azioni.",
    roles: ADMINS,
  },
];

export const PERMISSION_MATRIX_ROLES: UserRole[] = [
  "super_admin",
  "org_admin",
  "manager",
  "agent",
  "viewer",
];

export function roleHasPermission(area: PermissionArea, role: UserRole): boolean {
  return area.roles.includes(role);
}

export function getRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? role;
}
