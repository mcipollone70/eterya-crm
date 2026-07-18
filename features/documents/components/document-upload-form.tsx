"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/constants/documents";
import type { AttachmentEntityType } from "@/lib/supabase/types";
import { uploadDocumentAction } from "../actions/document-actions";

interface DocumentUploadFormProps {
  entityType: AttachmentEntityType;
  entityId: string;
  compact?: boolean;
}

export function DocumentUploadForm({ entityType, entityId, compact }: DocumentUploadFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const form = formRef.current;
    if (!form) {
      return;
    }
    const formData = new FormData(form);
    formData.set("entity_type", entityType);
    formData.set("entity_id", entityId);

    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      setMessage({ text: result.message, ok: result.success });
      if (result.success) {
        form.reset();
        setFileName(null);
        router.refresh();
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      }
    >
      <label className="flex-1">
        <span className="sr-only">Seleziona file</span>
        <input
          type="file"
          name="file"
          required
          accept={ALLOWED_DOCUMENT_EXTENSIONS.join(",")}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
      </label>

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Carica
      </Button>

      {fileName && !compact ? (
        <p className="w-full text-xs text-slate-500">Selezionato: {fileName}</p>
      ) : null}
      {message ? (
        <p className={`w-full text-xs ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
