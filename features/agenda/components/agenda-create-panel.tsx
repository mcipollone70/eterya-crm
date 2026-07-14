"use client";

import { useCallback, useState, useTransition } from "react";
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
import { AgendaToast, type AgendaToastVariant } from "./agenda-toast";

interface AgendaCreatePanelProps {
  companies: Array<{ id: string; name: string }>;
  fixedOnMobile?: boolean;
}

type CreateKind = "visit" | "follow_up" | "reminder";

interface ToastState {
  message: string;
  variant: AgendaToastVariant;
}

function defaultDateTimeLocal(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function buildNotesWithOptionalTitle(
  title: string,
  notes: string,
  defaultTitle: string
): string | null {
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  const titleCustomized = trimmedTitle.length > 0 && trimmedTitle !== defaultTitle;

  if (titleCustomized && trimmedNotes) {
    return `${trimmedTitle}\n\n${trimmedNotes}`;
  }
  if (titleCustomized) {
    return trimmedTitle;
  }
  return trimmedNotes || null;
}

export function AgendaCreatePanel({ companies, fixedOnMobile = false }: AgendaCreatePanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<CreateKind>("visit");
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [lastAutoTitle, setLastAutoTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const dismissToast = useCallback(() => setToast(null), []);

  function handleCompanyChange(companyId: string) {
    const companyName = companies.find((company) => company.id === companyId)?.name ?? "";
    setAppointmentTitle((current) => {
      const trimmed = current.trim();
      if (!trimmed || trimmed === lastAutoTitle) {
        return companyName;
      }
      return current;
    });
    setLastAutoTitle(companyName);
  }

  function resetFormFields() {
    setAppointmentTitle("");
    setLastAutoTitle("");
    setScheduledAt(defaultDateTimeLocal());
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = appointmentTitle.trim() || String(formData.get("appointment_title") ?? "").trim();
    const notes = String(formData.get("notes") ?? "");
    const companyId = String(formData.get("company_id") ?? "");
    const companyName = companies.find((company) => company.id === companyId)?.name ?? "";
    const scheduledRaw = String(formData.get("scheduled_at") ?? scheduledAt);
    const scheduledAtIso = scheduledRaw ? new Date(scheduledRaw).toISOString() : "";

    if (!title) {
      setToast({ message: "Inserisci un titolo per l'appuntamento.", variant: "error" });
      return;
    }

    startTransition(async () => {
      let result: { success: boolean; message: string };

      if (kind === "visit") {
        result = await agendaScheduleVisitAction({
          companyId,
          scheduledAt: scheduledAtIso,
          notes: buildNotesWithOptionalTitle(title, notes, companyName),
        });
      } else if (kind === "follow_up") {
        result = await agendaSaveFollowUpAction({
          companyId,
          activityType: String(formData.get("activity_type") ?? "call"),
          description: buildNotesWithOptionalTitle(title, notes, companyName),
          priority: (String(formData.get("priority") ?? "medium") as ActivityPriority) || "medium",
          scheduledAt: scheduledAtIso,
        });
      } else {
        result = await agendaSaveReminderAction({
          title,
          scheduledAt: scheduledAtIso,
          notes: notes.trim() || null,
          companyId: companyId || null,
        });
      }

      if (!result.success) {
        setToast({ message: result.message, variant: "error" });
        return;
      }

      form.reset();
      resetFormFields();
      setIsOpen(false);
      setToast({ message: "Appuntamento creato con successo", variant: "success" });
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

  const toastElement = toast ? (
    <AgendaToast message={toast.message} variant={toast.variant} onDismiss={dismissToast} />
  ) : null;

  if (!isOpen) {
    if (fixedOnMobile) {
      return (
        <>
          <div className="hidden lg:block">{openButton}</div>
          <StickyActionBar className="lg:hidden">{openButton}</StickyActionBar>
          {toastElement}
        </>
      );
    }
    return (
      <>
        {openButton}
        {toastElement}
      </>
    );
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
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">
            {kind === "reminder" ? "Azienda (opzionale)" : "Azienda"}
          </span>
          <select
            name="company_id"
            required={kind !== "reminder"}
            onChange={(event) => handleCompanyChange(event.target.value)}
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

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Titolo appuntamento</span>
          <input
            type="text"
            name="appointment_title"
            required
            value={appointmentTitle}
            onChange={(event) => setAppointmentTitle(event.target.value)}
            placeholder="Es. Visita cliente, follow-up commerciale..."
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
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

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
          <input
            type="datetime-local"
            name="scheduled_at"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            required
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note</span>
          <textarea
            name="notes"
            rows={5}
            placeholder="Inserisci dettagli della visita, obiettivi, prodotti da presentare, informazioni utili..."
            className="field-input min-h-[7.5rem] w-full resize-y rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

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
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:static lg:z-auto lg:bg-transparent">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
            <p className="font-semibold text-slate-900">Nuovo appuntamento</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
              Chiudi
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-24">{form}</div>
        </div>
        {toastElement}
      </>
    );
  }

  return (
    <>
      {form}
      {toastElement}
    </>
  );
}
