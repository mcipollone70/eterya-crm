"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { updateCompanyNotesAction } from "../actions/company-detail-actions";

interface CompanyDetailNotesTabProps {
  companyId: string;
  notes: string | null;
  internalNotes: string | null;
  updatedAt: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CompanyDetailNotesTab({
  companyId,
  notes,
  internalNotes,
  updatedAt,
}: CompanyDetailNotesTabProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateCompanyNotesAction(companyId, {
        notes: String(formData.get("notes") ?? "") || null,
        internalNotes: String(formData.get("internal_notes") ?? "") || null,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Note azienda</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Note</span>
              <textarea
                name="notes"
                rows={6}
                defaultValue={notes ?? ""}
                placeholder="Note visibili nella scheda azienda..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Note interne</span>
              <textarea
                name="internal_notes"
                rows={4}
                defaultValue={internalNotes ?? ""}
                placeholder="Note interne per il team commerciale..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>

            {error && <p className="text-sm text-rose-700">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salva note
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storico modifiche</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-sm text-slate-600">
            Ultimo aggiornamento registrato: {formatDateTime(updatedAt)}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Lo storico dettagliato delle revisioni non è ancora disponibile nel database. Verrà
            mostrato qui non appena attivato il tracciamento delle modifiche.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
