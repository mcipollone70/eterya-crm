"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type PasswordFormState,
} from "../actions/password-reset";
import { AuthShell } from "./auth-shell";

const initialState: PasswordFormState = {};

interface ForgotPasswordFormProps {
  configured: boolean;
  initialError?: string | null;
}

export function ForgotPasswordForm({
  configured,
  initialError = null,
}: ForgotPasswordFormProps) {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState
  );

  const errorMessage = state.error ?? initialError;

  return (
    <AuthShell description="Recupera l'accesso al tuo account.">
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Autenticazione non configurata. Imposta le variabili Supabase in
          <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code>
          per abilitare il recupero password.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <p className="text-sm text-slate-600">
          Inserisci l&apos;email dell&apos;account. Ti invieremo un link per impostare una
          nuova password.
        </p>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            placeholder="nome@azienda.it"
          />
        </div>

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMessage}
          </p>
        )}
        {state.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Invio in corso…" : "Invia link di recupero"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
          Torna al login
        </Link>
      </p>
    </AuthShell>
  );
}
