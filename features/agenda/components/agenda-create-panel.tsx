"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, Loader2, Plus } from "lucide-react";
import { Button, StickyActionBar } from "@/components/ui";
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
  fixedOnMobile?: boolean;
}

type CreateKind = "visit" | "follow_up" | "reminder";

function defaultDateTimeLocal(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AgendaCreatePanel({ companies, fixedOnMobile = false }: AgendaCreatePanelProps) {
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

  const openButton = (
    <Button
      type="button"
      size={fixedOnMobile ? "lg" : "sm"}
      className={fixedOnMobile ? "w-full shadow-md lg:w-auto lg:shadow-none" : undefined}
      onClick={() => setIsOpen(true)}
    >
      <Plus className="h-4 w-4" />
      Nuovo appuntamento
    </Button>
  );

  if (!isOpen) {
    if (fixedOnMobile) {
      return (
        <>
          <div className="hidden lg:block">{openButton}</div>
          <StickyActionBar className="lg:hidden">
            {openButton}
          </StickyActionBar>
        </>
      );
    }
    return openButton;
  }

  const form = (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:max-w-xl"
    >
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "visit" as const, label: "Visita", icon: CalendarPlus, active: "border-violet-200 bg-violet-50 text-violet-700" },
            { value: "follow_up" as const, label: "Follow-up", icon: Plus, active: "border-indigo-200 bg-indigo-50 text-indigo-700" },
            { value: "reminder" as const, label: "Promemoria", icon: Bell, active: "border-amber-200 bg-amber-50 text-amber-700" },
          ] as const
        ).map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              className={`inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 text-sm font-medium ${
                kind === option.value
                  ? option.active
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
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
              className="field-input w-full rounded-lg border border-slate-200 px-3"
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
            className="field-input w-full rounded-lg border border-slate-200 px-3"
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
                className="field-input w-full rounded-lg border border-slate-200 px-3"
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
                className="field-input w-full rounded-lg border border-slate-200 px-3"
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
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note</span>
          <input
            type="text"
            name="notes"
            placeholder="Dettagli..."
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="flex-1 sm:flex-none sm:h-8 sm:px-3 sm:text-xs" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1 sm:flex-none sm:h-8 sm:px-3 sm:text-xs"
          disabled={isPending}
          onClick={() => setIsOpen(false)}
        >
          Annulla
        </Button>
      </div>
    </form>
  );

  if (fixedOnMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white lg:static lg:z-auto lg:bg-transparent">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
          <p className="font-semibold text-slate-900">Nuovo appuntamento</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
            Chiudi
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">{form}</div>
      </div>
    );
  }

  return form;
}
