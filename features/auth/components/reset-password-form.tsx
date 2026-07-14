"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePasswordAction, type PasswordFormState } from "../actions/password-reset";
import { PASSWORD_RESET_SESSION_MISSING_MESSAGE } from "../utils/password-reset-messages";
import { AuthShell } from "./auth-shell";

const initialState: PasswordFormState = {};

interface ResetPasswordFormProps {
  configured: boolean;
  hasRecoverySession: boolean;
  initialError?: string | null;
}

export function ResetPasswordForm({
  configured,
  hasRecoverySession,
  initialError = null,
}: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  const errorMessage = state.error ?? initialError;
  const sessionMissing = !hasRecoverySession;

  return (
    <AuthShell description="Imposta una nuova password per il tuo account.">
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Autenticazione non configurata. Imposta le variabili Supabase in
          <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code>
          per abilitare il recupero password.
        </p>
      )}

      {sessionMissing ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {errorMessage ?? PASSWORD_RESET_SESSION_MISSING_MESSAGE}
          </p>
          <Link
            href="/login/forgot-password"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Richiedi un nuovo link
          </Link>
          <p className="text-center text-sm">
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
              Torna al login
            </Link>
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <p className="text-sm text-slate-600">
            Scegli una nuova password di almeno 6 caratteri.
          </p>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nuova password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Conferma password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {pending ? "Salvataggio…" : "Imposta nuova password"}
          </button>
        </form>
      )}

      {!sessionMissing && (
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Torna al login
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
