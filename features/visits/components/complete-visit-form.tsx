"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { VISIT_OUTCOME_OPTIONS } from "@/lib/constants/last-visit";
import { completeScheduledVisitAction } from "../actions/visit-mutations";

interface CompleteVisitFormProps {
  visitId: string;
  companyId: string;
  defaultNotes?: string | null;
  compact?: boolean;
}

function defaultDateTimeLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function CompleteVisitForm({
  visitId,
  companyId,
  defaultNotes,
  compact = false,
}: CompleteVisitFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(compact);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const completedAtRaw = String(formData.get("completed_at") ?? "");
    const durationRaw = String(formData.get("duration_minutes") ?? "");
    const nextCallbackRaw = String(formData.get("next_callback_at") ?? "");

    startTransition(async () => {
      const result = await completeScheduledVisitAction(visitId, companyId, {
        completedAt: completedAtRaw
          ? new Date(completedAtRaw).toISOString()
          : new Date().toISOString(),
        outcome: String(formData.get("outcome") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
        durationMinutes: durationRaw ? Number(durationRaw) : null,
        nextCallbackAt: nextCallbackRaw ? new Date(nextCallbackRaw).toISOString() : null,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Check className="h-4 w-4" />
        Completa
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-3 rounded-lg border border-slate-200 bg-white p-3 ${compact ? "" : "mt-2"}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Completata il</span>
          <input
            type="datetime-local"
            name="completed_at"
            defaultValue={defaultDateTimeLocal()}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Esito</span>
          <select
            name="outcome"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Seleziona esito</option>
            {VISIT_OUTCOME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Durata (min)</span>
          <input
            type="number"
            name="duration_minutes"
            min={1}
            max={480}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prossimo richiamo</span>
          <input
            type="datetime-local"
            name="next_callback_at"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaultNotes ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva esito
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
