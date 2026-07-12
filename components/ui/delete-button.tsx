"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "./button";

interface DeleteButtonProps {
  /** Server Action già "bindata" con l'id del record; redirige in caso di successo. */
  action: () => Promise<{ error?: string } | void>;
  confirmMessage: string;
  label?: string;
}

/**
 * Pulsante di eliminazione condiviso: conferma nativa, stato pending e
 * visualizzazione dell'eventuale errore restituito dalla Server Action.
 */
export function DeleteButton({
  action,
  confirmMessage,
  label = "Elimina",
}: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
