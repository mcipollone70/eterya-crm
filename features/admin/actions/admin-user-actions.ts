"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logAuditEvent } from "@/features/audit/services/audit-log.service";
import type { UserRole } from "@/lib/supabase/types";
import { isAssignableRole } from "../constants/user-roles";
import {
  isAdminActionError,
  requireAdminProfile,
} from "../services/admin-auth.service";
import {
  createAdminUser,
  deactivateAdminUser,
  inviteAdminUser,
  sendAdminPasswordReset,
  updateAdminUser,
} from "../services/admin-users.service";
import type { AdminActionResult } from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi le variabili Supabase in .env.local.";

const ADMIN_PATH = "/admin/users";

async function guardAdmin(): Promise<AdminActionResult | null> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const profile = await requireAdminProfile();
  if (isAdminActionError(profile)) {
    return profile;
  }

  return null;
}

function revalidateAdminUsers() {
  revalidatePath(ADMIN_PATH);
}

export async function createAdminUserAction(
  _prevState: FormState & { message?: string },
  formData: FormData
): Promise<FormState & { message?: string }> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isActive = formData.get("is_active") !== "false";
  const createMode = String(formData.get("create_mode") ?? "password").trim();
  const inviteMode = createMode === "invite";

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Il nome è obbligatorio.";
  if (!email) fieldErrors.email = "L'email è obbligatoria.";
  if (!isAssignableRole(role)) fieldErrors.role = "Seleziona un ruolo valido.";
  if (!inviteMode && password.length < 6) {
    fieldErrors.password = "La password deve contenere almeno 6 caratteri.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const profileInput = {
    fullName,
    email,
    role: role as UserRole,
    isActive,
  };

  const { id, error } = inviteMode
    ? await inviteAdminUser(profileInput)
    : await createAdminUser({ ...profileInput, password });

  if (error || !id) {
    return {
      error: error ?? (inviteMode ? "Invio invito non riuscito." : "Creazione utente non riuscita."),
    };
  }

  await logAuditEvent({
    action: inviteMode ? "invite" : "create",
    entityType: "user",
    entityId: id,
    summary: `${inviteMode ? "Invito" : "Creazione"} utente ${email} (${role})`,
  });

  revalidateAdminUsers();
  redirect(`${ADMIN_PATH}/${id}/edit?${inviteMode ? "invited=1" : "created=1"}`);
}

export async function updateAdminUserAction(
  userId: string,
  _prevState: FormState & { message?: string },
  formData: FormData
): Promise<FormState & { message?: string }> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const actingAdmin = await requireAdminProfile();
  if (isAdminActionError(actingAdmin)) {
    return actingAdmin;
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const isActive = formData.get("is_active") === "true";
  const reassignTo = String(formData.get("reassign_companies_to") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Il nome è obbligatorio.";
  if (!isAssignableRole(role) && role !== "manager" && role !== "super_admin") {
    fieldErrors.role = "Seleziona un ruolo valido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (actingAdmin.id === userId && !isActive) {
    return { error: "Non puoi disattivare il tuo account." };
  }

  const { error, message } = await updateAdminUser(userId, {
    fullName,
    role: role as Parameters<typeof updateAdminUser>[1]["role"],
    isActive,
    reassignCompaniesToUserId: reassignTo,
  });

  if (error) {
    return { error };
  }

  await logAuditEvent({
    action: "update",
    entityType: "user",
    entityId: userId,
    summary: `Aggiornamento utente ${fullName} (${role})`,
  });

  revalidateAdminUsers();
  revalidatePath(`${ADMIN_PATH}/${userId}/edit`);
  return { message: message ?? "Utente aggiornato." };
}

export async function deactivateAdminUserAction(
  userId: string
): Promise<AdminActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const actingAdmin = await requireAdminProfile();
  if (isAdminActionError(actingAdmin)) {
    return actingAdmin;
  }

  if (actingAdmin.id === userId) {
    return { error: "Non puoi disattivare il tuo account." };
  }

  const { error, message } = await deactivateAdminUser(userId);
  if (error) {
    return { error };
  }

  await logAuditEvent({
    action: "deactivate",
    entityType: "user",
    entityId: userId,
    summary: "Disattivazione account utente",
  });

  revalidateAdminUsers();
  return { message };
}

export async function sendPasswordResetAction(
  userId: string,
  email: string
): Promise<AdminActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  if (!email.trim()) {
    return { error: "Email utente mancante." };
  }

  const { error, message } = await sendAdminPasswordReset(email.trim());
  if (error) {
    return { error };
  }

  revalidatePath(`${ADMIN_PATH}/${userId}/edit`);
  return { message };
}
