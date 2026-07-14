"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { VISIT_OUTCOME_OPTIONS } from "@/lib/constants/last-visit";
import { saveVisitAction } from "@/features/visits/actions/visit-mutations";

interface RecordVisitFormProps {
  companyId: string;
  defaultOpen?: boolean;
}

export function RecordVisitForm({ companyId, defaultOpen = false }: RecordVisitFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const completedAtRaw = String(formData.get("completed_at") ?? "");
    const durationRaw = String(formData.get("duration_minutes") ?? "");
    const nextCallbackRaw = String(formData.get("next_callback_at") ?? "");

    startTransition(async () => {
      const result = await saveVisitAction({
        companyId,
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
        Registra visita
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data e ora visita</span>
          <input
            type="datetime-local"
            name="completed_at"
            defaultValue={defaultDateTime}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Esito</span>
          <select name="outcome" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            <option value="">Seleziona esito</option>
            {VISIT_OUTCOME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Durata (minuti)</span>
          <input
            type="number"
            name="duration_minutes"
            min={1}
            max={480}
            placeholder="es. 45"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Prossimo richiamo</span>
          <input
            type="datetime-local"
            name="next_callback_at"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Note visita</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="Appunti sulla visita..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salva visita
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
