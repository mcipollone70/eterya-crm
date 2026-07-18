"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import type { AttachmentEntityType } from "@/lib/supabase/types";
import {
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
} from "../actions/document-actions";

interface DocumentRowActionsProps {
  documentId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
}

export function DocumentRowActions({
  documentId,
  entityType,
  entityId,
  fileName,
}: DocumentRowActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, startDownload] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleDownload() {
    setError(null);
    startDownload(async () => {
      const result = await getDocumentDownloadUrlAction(documentId);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.error ?? "Download non disponibile.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Eliminare il documento "${fileName}"?`)) {
      return;
    }
    setError(null);
    startDelete(async () => {
      const result = await deleteDocumentAction(documentId, entityType, entityId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
        aria-label="Scarica documento"
        title="Scarica"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        aria-label="Elimina documento"
        title="Elimina"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
      {error ? <span className="ml-1 text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}
