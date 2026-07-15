import type { UserRole } from "@/lib/supabase/types";

/** Ruoli che possono accedere al modulo Amministrazione. */
export const ADMIN_ACCESS_ROLES: UserRole[] = ["super_admin", "org_admin"];

/** Ruoli assegnabili da un amministratore via UI. */
export const ASSIGNABLE_USER_ROLES: UserRole[] = ["org_admin", "agent", "viewer"];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super amministratore",
  org_admin: "Amministratore",
  manager: "Manager",
  agent: "Agente",
  viewer: "Sola lettura",
};

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ACCESS_ROLES.includes(role);
}

export function isAssignableRole(role: string): role is UserRole {
  return ASSIGNABLE_USER_ROLES.includes(role as UserRole);
}

export function getUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export function getUserRoleBadgeVariant(
  role: UserRole
): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (role) {
    case "super_admin":
    case "org_admin":
      return "info";
    case "manager":
      return "warning";
    case "agent":
      return "success";
    case "viewer":
      return "muted";
    default:
      return "default";
  }
}
