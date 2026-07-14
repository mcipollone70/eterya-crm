"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button, StickyActionBar } from "@/components/ui";
import { scheduleVisitAction } from "../actions/visit-mutations";
import type { VisitCompanyOption } from "../services/visits.service";

interface ScheduleVisitFormProps {
  companies: VisitCompanyOption[];
  defaultCompanyId?: string;
  fixedOnMobile?: boolean;
}

export function ScheduleVisitForm({
  companies,
  defaultCompanyId,
  fixedOnMobile = false,
}: ScheduleVisitFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultDateTime = (() => {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  })();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const scheduledAtRaw = String(formData.get("scheduled_at") ?? "");

    startTransition(async () => {
      const result = await scheduleVisitAction({
        companyId: String(formData.get("company_id") ?? ""),
        scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : "",
        notes: String(formData.get("notes") ?? "") || null,
      });

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
      <CalendarPlus className="h-4 w-4" />
      Pianifica visita
    </Button>
  );

  if (!isOpen) {
    if (fixedOnMobile) {
      return (
        <>
          <div className="hidden lg:block">{openButton}</div>
          <StickyActionBar className="lg:hidden">{openButton}</StickyActionBar>
        </>
      );
    }
    return openButton;
  }

  const form = (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Azienda</span>
          <select
            name="company_id"
            required
            defaultValue={defaultCompanyId ?? ""}
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          >
            <option value="">Seleziona azienda</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
                {company.city ? ` · ${company.city}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
          <input
            type="datetime-local"
            name="scheduled_at"
            defaultValue={defaultDateTime}
            required
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note (opzionale)</span>
          <input
            type="text"
            name="notes"
            placeholder="Obiettivo della visita..."
            className="field-input w-full rounded-lg border border-slate-200 px-3"
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="flex-1 sm:flex-none sm:h-8 sm:px-3 sm:text-xs" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva pianificazione
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
          <p className="font-semibold text-slate-900">Pianifica visita</p>
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
