"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getAuthAppBaseUrl } from "../utils/app-url";
import {
  mapPasswordResetRequestError,
  mapPasswordUpdateError,
  PASSWORD_RESET_EMAIL_SENT_MESSAGE,
} from "../utils/password-reset-messages";

export interface PasswordFormState {
  error?: string;
  message?: string;
}

const NOT_CONFIGURED_MESSAGE =
  "Autenticazione non configurata. Imposta le variabili Supabase in .env.local.";

function getPasswordResetRedirectUrl(): string {
  const next = encodeURIComponent("/login/reset-password");
  return `${getAuthAppBaseUrl()}/auth/callback?next=${next}`;
}

export async function requestPasswordResetAction(
  _prevState: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Inserisci l'indirizzo email dell'account." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    return { error: mapPasswordResetRequestError(error.message) };
  }

  return { message: PASSWORD_RESET_EMAIL_SENT_MESSAGE };
}

export async function updatePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) {
    return { error: "La password deve contenere almeno 6 caratteri." };
  }

  if (password !== confirmPassword) {
    return { error: "Le password non coincidono." };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Il link di recupero non è valido o è scaduto. Richiedi un nuovo link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: mapPasswordUpdateError(error.message) };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}
