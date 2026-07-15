"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/supabase/types";
import { isAssignableRole } from "../constants/user-roles";
import {
  isAdminActionError,
  requireAdminProfile,
} from "../services/admin-auth.service";
import {
  createAdminUser,
  deactivateAdminUser,
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

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Il nome è obbligatorio.";
  if (!email) fieldErrors.email = "L'email è obbligatoria.";
  if (!isAssignableRole(role)) fieldErrors.role = "Seleziona un ruolo valido.";
  if (password.length < 6) {
    fieldErrors.password = "La password deve contenere almeno 6 caratteri.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const { id, error, message } = await createAdminUser({
    fullName,
    email,
    role: role as UserRole,
    password,
    isActive,
  });

  if (error || !id) {
    return { error: error ?? "Creazione utente non riuscita." };
  }

  revalidateAdminUsers();
  redirect(`${ADMIN_PATH}/${id}/edit?created=1`);
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
