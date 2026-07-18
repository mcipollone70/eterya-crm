"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileOutput, Loader2, Mail, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import {
  convertQuoteToOrderAction,
  duplicateQuoteAction,
} from "../actions/quote-actions";
import type { QuoteListItem } from "../services/quotes.service";

interface QuoteActionsPanelProps {
  quote: QuoteListItem;
  companyEmail?: string | null;
}

export function QuoteActionsPanel({ quote, companyEmail }: QuoteActionsPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await duplicateQuoteAction(quote.id, quote.company_id);
      if (!result.success || !result.quoteId) {
        setError(result.message);
        return;
      }
      router.push(`/preventivi/${result.quoteId}`);
    });
  }

  function handleConvert() {
    if (!window.confirm("Convertire questo preventivo in ordine?")) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await convertQuoteToOrderAction(quote.id, quote.company_id);
      if (!result.success || !result.orderId) {
        setError(result.message);
        return;
      }
      router.push(`/ordini/${result.orderId}`);
    });
  }

  function handleMailto() {
    const subject = encodeURIComponent(
      `Preventivo${quote.number ? ` ${quote.number}` : ""} — ${quote.title}`
    );
    const body = encodeURIComponent(
      [
        `Gentile Cliente,`,
        ``,
        `in allegato / di seguito il preventivo${quote.number ? ` n. ${quote.number}` : ""}:`,
        quote.title,
        `Importo: ${quote.total_amount.toLocaleString("it-IT", { style: "currency", currency: quote.currency })}`,
        quote.valid_until
          ? `Validità: ${new Date(quote.valid_until).toLocaleDateString("it-IT")}`
          : "",
        ``,
        `Cordiali saluti`,
      ]
        .filter(Boolean)
        .join("\n")
    );
    const to = companyEmail?.trim() || "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function handleCopyDraft() {
    const draft = [
      `Preventivo${quote.number ? ` ${quote.number}` : ""}: ${quote.title}`,
      `Azienda: ${quote.company_name ?? "—"}`,
      `Importo: ${quote.total_amount.toLocaleString("it-IT", { style: "currency", currency: quote.currency })}`,
      quote.product_names.length > 0 ? `Prodotti: ${quote.product_names.join(", ")}` : "",
      quote.notes ? `Note: ${quote.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(draft);
      setMessage("Bozza email copiata negli appunti.");
    } catch {
      setError("Impossibile copiare la bozza.");
    }
  }

  const canConvert = quote.stage !== "won" && quote.status !== "cancelled";

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => window.open(`/preventivi/${quote.id}/stampa`, "_blank")}
      >
        <Printer className="h-4 w-4" />
        Stampa / PDF
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={handleMailto}
      >
        <Mail className="h-4 w-4" />
        Prepara email (mailto)
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={handleCopyDraft}
      >
        <Copy className="h-4 w-4" />
        Copia bozza email
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        disabled={isPending}
        onClick={handleDuplicate}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Duplica preventivo
      </Button>

      {canConvert && (
        <Button
          type="button"
          size="sm"
          className="w-full justify-start"
          disabled={isPending}
          onClick={handleConvert}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileOutput className="h-4 w-4" />
          )}
          Converti in ordine
        </Button>
      )}

      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">
        L&apos;invio email prepara solo la bozza (mailto / copia). Nessun invio automatico.
      </p>
    </div>
  );
}
