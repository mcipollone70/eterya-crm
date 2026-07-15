"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/lib/forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@/components/ui";
import {
  ASSIGNABLE_USER_ROLES,
  getUserRoleLabel,
} from "../constants/user-roles";

const controlClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

type CreateUserMode = "password" | "invite";

interface CreateAdminUserFormProps {
  action: (prevState: FormState & { message?: string }, formData: FormData) => Promise<FormState & { message?: string }>;
}

export function CreateAdminUserForm({ action }: CreateAdminUserFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [createMode, setCreateMode] = useState<CreateUserMode>("password");
  const inviteMode = createMode === "invite";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="create_mode" value={createMode} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nuovo utente</CardTitle>
          <CardDescription>
            {inviteMode
              ? "Invia un invito via email: l'utente imposterà la password al primo accesso."
              : "Crea l'account in Supabase Auth e il profilo CRM. Comunica la password provvisoria all'agente in modo sicuro."}
          </CardDescription>
          <div className="pt-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setCreateMode("password")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  createMode === "password"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Password provvisoria
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("invite")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                  createMode === "invite"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Invia invito via email
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input id="full_name" name="full_name" required className={controlClass} />
            {state.fieldErrors?.full_name && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.full_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input id="email" name="email" type="email" required className={controlClass} />
            {state.fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Ruolo <span className="text-red-500">*</span>
            </label>
            <select id="role" name="role" required defaultValue="agent" className={controlClass}>
              {ASSIGNABLE_USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {getUserRoleLabel(role)}
                </option>
              ))}
            </select>
            {state.fieldErrors?.role && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.role}</p>
            )}
          </div>

          {!inviteMode && (
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                Password provvisoria <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={controlClass}
              />
              {state.fieldErrors?.password && (
                <p className="mt-1 text-xs text-red-600">{state.fieldErrors.password}</p>
              )}
            </div>
          )}

          <div className={inviteMode ? "sm:col-span-2" : undefined}>
            <label htmlFor="is_active" className="mb-1 block text-sm font-medium text-slate-700">
              Stato
            </label>
            <select id="is_active" name="is_active" defaultValue="true" className={controlClass}>
              <option value="true">Attivo</option>
              <option value="false">Disattivo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/users">
          <Button type="button" variant="outline">
            Annulla
          </Button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending
            ? inviteMode
              ? "Invio invito…"
              : "Creazione…"
            : inviteMode
              ? "Invia invito"
              : "Crea utente"}
        </Button>
      </div>
    </form>
  );
}

interface EditAdminUserFormProps {
  userId: string;
  defaults: {
    full_name: string;
    role: string;
    is_active: boolean;
    assigned_companies_count: number;
  };
  agents: { id: string; label: string }[];
  action: (prevState: FormState, formData: FormData) => Promise<FormState & { message?: string }>;
  flashMessage?: string | null;
}

export function EditAdminUserForm({
  userId,
  defaults,
  agents,
  action,
  flashMessage,
}: EditAdminUserFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  const message = state.message ?? flashMessage;
  const roleLocked = defaults.role === "super_admin";

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dati utente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              defaultValue={defaults.full_name}
              className={controlClass}
            />
            {state.fieldErrors?.full_name && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.full_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Ruolo
            </label>
            {roleLocked ? (
              <>
                <input type="hidden" name="role" value={defaults.role} />
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {getUserRoleLabel(defaults.role as Parameters<typeof getUserRoleLabel>[0])}
                </p>
              </>
            ) : (
              <select
                id="role"
                name="role"
                defaultValue={defaults.role}
                className={controlClass}
              >
                {ASSIGNABLE_USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {getUserRoleLabel(role)}
                  </option>
                ))}
                {defaults.role === "manager" && (
                  <option value="manager">{getUserRoleLabel("manager")}</option>
                )}
              </select>
            )}
            {state.fieldErrors?.role && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors.role}</p>
            )}
          </div>

          <div>
            <label htmlFor="is_active" className="mb-1 block text-sm font-medium text-slate-700">
              Stato account
            </label>
            <select
              id="is_active"
              name="is_active"
              defaultValue={defaults.is_active ? "true" : "false"}
              className={controlClass}
            >
              <option value="true">Attivo</option>
              <option value="false">Disattivo</option>
            </select>
          </div>

          {defaults.assigned_companies_count > 0 && (
            <div className="sm:col-span-2">
              <label
                htmlFor="reassign_companies_to"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Riassegna aziende ({defaults.assigned_companies_count})
              </label>
              <select
                id="reassign_companies_to"
                name="reassign_companies_to"
                defaultValue=""
                className={controlClass}
              >
                <option value="">— Non riassegnare —</option>
                {agents
                  .filter((agent) => agent.id !== userId)
                  .map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Opzionale: sposta tutte le aziende assegnate a questo utente verso un altro
                agente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/users">
          <Button type="button" variant="outline">
            Torna alla lista
          </Button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </Button>
      </div>
    </form>
  );
}
