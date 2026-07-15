import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/features/auth/session";
import type { AppUserProfile } from "@/features/auth/types";
import { isAdminRole } from "../constants/user-roles";
import type { AdminActionResult } from "../types";

const ACCESS_DENIED_MESSAGE = "Accesso riservato agli amministratori.";

export async function requireAdminProfile(): Promise<
  AppUserProfile | AdminActionResult
> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { error: "Sessione non valida. Accedi di nuovo." };
  }

  if (!profile.isActive) {
    return { error: "Account disattivato. Contatta un amministratore." };
  }

  if (!isAdminRole(profile.role)) {
    return { error: ACCESS_DENIED_MESSAGE };
  }

  return profile;
}

export function isAdminActionError(
  result: AppUserProfile | AdminActionResult
): result is AdminActionResult {
  return "error" in result && typeof result.error === "string";
}

/** Per le pagine RSC: redirect se l'utente non è admin. */
export async function assertAdminPageAccess(): Promise<AppUserProfile> {
  const result = await requireAdminProfile();

  if (isAdminActionError(result)) {
    redirect("/?access=denied");
  }

  return result;
}
