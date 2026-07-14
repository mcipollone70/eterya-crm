"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { CONTACT_HISTORY_TYPE_OPTIONS } from "@/lib/constants/contact-history";
import { FOLLOW_UP_PRIORITY_OPTIONS } from "@/lib/constants/follow-up";
import type { ActivityPriority } from "@/lib/supabase/types";
import {
  agendaSaveFollowUpAction,
  agendaSaveReminderAction,
  agendaScheduleVisitAction,
} from "../actions/agenda-actions";

interface AgendaCreatePanelProps {
  companies: Array<{ id: string; name: string }>;
}

type CreateKind = "visit" | "follow_up" | "reminder";

function defaultDateTimeLocal(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AgendaCreatePanel({ companies }: AgendaCreatePanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<CreateKind>("visit");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const scheduledRaw = String(formData.get("scheduled_at") ?? "");
    const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : "";

    startTransition(async () => {
      let result: { success: boolean; message: string };

      if (kind === "visit") {
        result = await agendaScheduleVisitAction({
          companyId: String(formData.get("company_id") ?? ""),
          scheduledAt,
          notes: String(formData.get("notes") ?? "") || null,
        });
      } else if (kind === "follow_up") {
        result = await agendaSaveFollowUpAction({
          companyId: String(formData.get("company_id") ?? ""),
          activityType: String(formData.get("activity_type") ?? "call"),
          description: String(formData.get("notes") ?? "") || null,
          priority: (String(formData.get("priority") ?? "medium") as ActivityPriority) || "medium",
          scheduledAt,
        });
      } else {
        result = await agendaSaveReminderAction({
          title: String(formData.get("title") ?? ""),
          scheduledAt,
          notes: String(formData.get("notes") ?? "") || null,
          companyId: String(formData.get("company_id") ?? "") || null,
        });
      }

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      setIsOpen(false);
      event.currentTarget.reset();
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuovo appuntamento
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setKind("visit")}
          className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium ${
            kind === "visit"
              ? "border-violet-200 bg-violet-50 text-violet-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Visita
        </button>
        <button
          type="button"
          onClick={() => setKind("follow_up")}
          className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium ${
            kind === "follow_up"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          Follow-up
        </button>
        <button
          type="button"
          onClick={() => setKind("reminder")}
          className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium ${
            kind === "reminder"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          Promemoria
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "reminder" && (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Titolo</span>
            <input
              type="text"
              name="title"
              required
              placeholder="Es. Preparare offerta..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        )}

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">
            {kind === "reminder" ? "Azienda (opzionale)" : "Azienda"}
          </span>
          <select
            name="company_id"
            required={kind !== "reminder"}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">{kind === "reminder" ? "Nessuna azienda" : "Seleziona azienda"}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        {kind === "follow_up" && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tipo attività</span>
              <select
                name="activity_type"
                defaultValue="call"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Priorità</span>
              <select
                name="priority"
                defaultValue="medium"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {FOLLOW_UP_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
          <input
            type="datetime-local"
            name="scheduled_at"
            defaultValue={defaultDateTimeLocal()}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note</span>
          <input
            type="text"
            name="notes"
            placeholder="Dettagli..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
