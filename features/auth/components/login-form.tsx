"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { authenticateAction, type AuthFormState } from "../actions/auth";
import { APP_NAME } from "@/lib/constants/navigation";

const initialState: AuthFormState = {};

interface LoginFormProps {
  configured: boolean;
}

export function LoginForm({ configured }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    authenticateAction,
    initialState
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Accedi per gestire le tue aziende e attività.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {!configured && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Autenticazione non configurata. Imposta le variabili Supabase in
              <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code>
              per abilitare l&apos;accesso.
            </p>
          )}

          <form action={formAction} className="space-y-4">
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

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {state.error}
              </p>
            )}
            {state.message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {state.message}
              </p>
            )}

            <button
              type="submit"
              name="intent"
              value="signin"
              disabled={pending}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "Attendere…" : "Accedi"}
            </button>

            <button
              type="submit"
              name="intent"
              value="signup"
              disabled={pending}
              className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
            >
              Crea un account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
