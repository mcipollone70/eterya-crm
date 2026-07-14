"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { VoiceNotesInput } from "@/features/voice/components/voice-notes-input";
import { CONTACT_HISTORY_TYPE_OPTIONS } from "@/lib/constants/contact-history";
import { FOLLOW_UP_PRIORITY_OPTIONS } from "@/lib/constants/follow-up";
import type { ActivityPriority } from "@/lib/supabase/types";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { saveFollowUpAction } from "../actions/follow-up-actions";

interface NewFollowUpFormProps {
  companyId: string;
  contacts?: ContactListItem[];
}

export function NewFollowUpForm({ companyId, contacts = [] }: NewFollowUpFormProps) {
  const [description, setDescription] = useState("");
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
    const scheduledRaw = String(formData.get("scheduled_at") ?? "");

    startTransition(async () => {
      const result = await saveFollowUpAction({
        companyId,
        contactId: String(formData.get("contact_id") ?? "") || null,
        activityType: String(formData.get("activity_type") ?? "call"),
        description: description.trim() || null,
        priority: (String(formData.get("priority") ?? "medium") as ActivityPriority) || "medium",
        scheduledAt: scheduledRaw
          ? new Date(scheduledRaw).toISOString()
          : new Date().toISOString(),
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
  const defaultDateTime = new Date(nowLocal.getTime() + 24 * 60 * 60 * 1000 - nowLocal.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  if (!isOpen) {
    return (
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuovo follow-up
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
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

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo attività</span>
          <select name="activity_type" defaultValue="call" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            {CONTACT_HISTORY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Priorità</span>
          <select name="priority" defaultValue="medium" className="w-full rounded-lg border border-slate-200 px-3 py-2">
            {FOLLOW_UP_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {contacts.length > 0 && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contatto</span>
            <select name="contact_id" className="w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="">Nessun contatto</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <VoiceNotesInput
        label="Descrizione"
        value={description}
        onChange={setDescription}
        rows={3}
        placeholder="Cosa fare nel follow-up..."
      />

      {error && <p className="text-sm text-rose-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          Salva follow-up
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setIsOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
