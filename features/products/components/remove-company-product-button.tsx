"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { removeCompanyProductAction } from "../actions/product-actions";

interface RemoveCompanyProductButtonProps {
  interestId: string;
  companyId: string;
  productName: string;
}

export function RemoveCompanyProductButton({
  interestId,
  companyId,
  productName,
}: RemoveCompanyProductButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!window.confirm(`Rimuovere "${productName}" da questa azienda?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeCompanyProductAction(interestId, companyId);
      if (!result.success) {
        setError(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
        onClick={handleClick}
        disabled={isPending}
        aria-label={`Rimuovi ${productName}`}
        title="Rimuovi"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
