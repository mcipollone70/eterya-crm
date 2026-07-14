"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { scheduleVisitAction } from "../actions/visit-mutations";
import type { VisitCompanyOption } from "../services/visits.service";

interface ScheduleVisitFormProps {
  companies: VisitCompanyOption[];
  defaultCompanyId?: string;
}

export function ScheduleVisitForm({ companies, defaultCompanyId }: ScheduleVisitFormProps) {
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

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Pianifica visita
      </Button>
    );
  }

  return (
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Note (opzionale)</span>
          <input
            type="text"
            name="notes"
            placeholder="Obiettivo della visita..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva pianificazione
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setIsOpen(false)}
        >
          Annulla
        </Button>
      </div>
    </form>
  );
}
