"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui";
import { sendQuoteAction } from "../actions/quote-actions";

interface QuoteSendButtonProps {
  quoteId: string;
  companyId: string;
  disabled?: boolean;
}

export function QuoteSendButton({ quoteId, companyId, disabled }: QuoteSendButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendQuoteAction(quoteId, companyId);
      setMessage(result.message);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" size="sm" onClick={handleSend} disabled={disabled || isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Segna come inviato
      </Button>
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}
