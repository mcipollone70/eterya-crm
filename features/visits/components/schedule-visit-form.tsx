"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button, StickyActionBar } from "@/components/ui";
import { CompanySelect } from "@/features/companies/components/company-select";
import { scheduleVisitAction } from "../actions/visit-mutations";

interface ScheduleVisitFormProps {
  defaultCompanyId?: string;
  fixedOnMobile?: boolean;
}

export function ScheduleVisitForm({
  defaultCompanyId,
  fixedOnMobile = false,
}: ScheduleVisitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
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

    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const scheduledAtRaw = String(formData.get("scheduled_at") ?? "");

    startTransition(async () => {
      const result = await scheduleVisitAction({
        companyId: String(formData.get("company_id") ?? companyId),
        scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : "",
        notes: String(formData.get("notes") ?? "") || null,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      setIsOpen(false);
      form.reset();
      setCompanyId("");
      router.refresh();
    });
  }

  const openButton = (
    <Button
      type="button"
      size={fixedOnMobile ? "lg" : "sm"}
      className={fixedOnMobile ? "w-full shadow-md lg:w-auto lg:shadow-none" : undefined}
      onClick={() => {
        setCompanyId(defaultCompanyId ?? "");
        setIsOpen(true);
      }}
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
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Azienda</span>
          <CompanySelect
            name="company_id"
            value={companyId}
            onChange={setCompanyId}
            required
            allowEmpty={false}
            placeholder="Seleziona azienda"
            selectClassName="field-input"
            pinnedIds={defaultCompanyId ? [defaultCompanyId] : []}
          />
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
      <>
        <div className="hidden lg:block">{form}</div>
        <StickyActionBar className="lg:hidden">{openButton}</StickyActionBar>
      </>
    );
  }

  return form;
}
