"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  CONTACT_HISTORY_TYPE_OPTIONS,
  CONTACT_OUTCOME_OPTIONS,
  type ContactHistoryType,
} from "@/lib/constants/contact-history";
import { saveContactHistoryAction } from "../actions/contact-history-actions";

interface RecordContactActivityFormProps {
  companyId: string;
}

export function RecordContactActivityForm({ companyId }: RecordContactActivityFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const type = String(formData.get("type") ?? "note") as ContactHistoryType;
    const occurredAtRaw = String(formData.get("occurred_at") ?? "");
    const followUpRaw = String(formData.get("next_follow_up_at") ?? "");

    startTransition(async () => {
      const result = await saveContactHistoryAction({
        companyId,
        type,
        title: String(formData.get("title") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || null,
        outcome: String(formData.get("outcome") ?? "") || null,
        occurredAt: occurredAtRaw
          ? new Date(occurredAtRaw).toISOString()
          : new Date().toISOString(),
        nextFollowUpAt: followUpRaw ? new Date(followUpRaw).toISOString() : null,
        attachments: [],
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

  const nowLocal = new Date();
  const defaultDateTime = new Date(
    nowLocal.getTime() - nowLocal.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Registra attività
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipologia</span>
          <select name="type" defaultValue="call" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
          <input
            type="datetime-local"
            name="occurred_at"
            defaultValue={defaultDateTime}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Titolo</span>
          <input
            type="text"
            name="title"
            placeholder="Opzionale — verrà usata la tipologia"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Esito</span>
          <select name="outcome" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Seleziona esito</option>
            {CONTACT_OUTCOME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prossimo follow-up</span>
          <input
            type="datetime-local"
            name="next_follow_up_at"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Descrizione</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Dettagli dell'attività..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Paperclip className="h-3.5 w-3.5" />
        Allegati: predisposizione attiva, caricamento file in arrivo.
      </p>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva nello storico
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
