"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { saveFollowUpAction } from "@/features/activities/actions/follow-up-actions";
import { VoiceNotesInput } from "@/features/voice/components/voice-notes-input";
import { CONTACT_HISTORY_TYPE_OPTIONS } from "@/lib/constants/contact-history";

interface BriefingFollowUpSheetProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
}

function defaultDateTimeLocal(hoursAhead = 24): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursAhead, 0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function BriefingFollowUpSheet({
  companyId,
  companyName,
  onClose,
}: BriefingFollowUpSheetProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal());
  const [activityType, setActivityType] = useState("call");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await saveFollowUpAction({
        companyId,
        activityType,
        description: description.trim() || null,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-indigo-700">Crea follow-up</p>
            <h2 className="text-lg font-bold text-slate-900">{companyName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Data e ora</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
              className="field-input w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tipo attività</span>
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value)}
              className="field-input w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <VoiceNotesInput
            label="Descrizione"
            value={description}
            onChange={setDescription}
            rows={4}
            placeholder="Dettagli del follow-up..."
          />

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}

          <Button type="submit" size="lg" className="w-full min-h-11" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Salva follow-up
          </Button>
        </form>
      </div>
    </div>
  );
}
