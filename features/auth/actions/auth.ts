"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const NOT_CONFIGURED_MESSAGE =
  "Autenticazione non configurata. Imposta le variabili Supabase in .env.local.";

/**
 * Gestisce sia l'accesso che la registrazione in base al campo `intent` del form,
 * così il form di login condivide un'unica azione e un unico stato di errore.
 */
export async function authenticateAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const intent = formData.get("intent") === "signup" ? "signup" : "signin";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createServerClient();

  if (intent === "signup") {
    if (password.length < 6) {
      return { error: "La password deve contenere almeno 6 caratteri." };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }

    // Con la conferma email attiva la sessione non è ancora disponibile.
    if (!data.session) {
      return {
        message:
          "Account creato. Controlla l'email per confermare l'indirizzo, poi accedi.",
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { error: error.message };
    }
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
