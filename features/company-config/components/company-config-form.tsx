"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { saveCompanyConfigAction } from "../actions/company-config-actions";
import type { CompanyConfig } from "../services/company-config.service";

interface CompanyConfigFormProps {
  config: CompanyConfig;
}

export function CompanyConfigForm({ config }: CompanyConfigFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveCompanyConfigAction(formData);
      setMessage({ text: result.message, ok: result.success });
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Ragione sociale</span>
          <input
            type="text"
            name="company_name"
            defaultValue={config.companyName}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Partita IVA</span>
          <input
            type="text"
            name="vat_number"
            defaultValue={config.vatNumber}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            defaultValue={config.email}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Indirizzo</span>
          <input
            type="text"
            name="address"
            defaultValue={config.address}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Telefono</span>
          <input
            type="text"
            name="phone"
            defaultValue={config.phone}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Sito web</span>
          <input
            type="text"
            name="website"
            defaultValue={config.website}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Valuta predefinita</span>
          <input
            type="text"
            name="default_currency"
            defaultValue={config.defaultCurrency}
            maxLength={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Validità preventivi (giorni)</span>
          <input
            type="number"
            name="quote_validity_days"
            min={1}
            defaultValue={config.quoteValidityDays}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note interne</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={config.notes}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {message ? (
        <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Salva configurazione
      </Button>
    </form>
  );
}
