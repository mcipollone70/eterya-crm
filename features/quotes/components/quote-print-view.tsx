"use client";

import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quotes";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { QuoteListItem } from "../services/quotes.service";

interface QuotePrintViewProps {
  quote: QuoteListItem;
}

export function QuotePrintView({ quote }: QuotePrintViewProps) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-300 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Eterya CRM
          </p>
          <h1 className="mt-2 text-2xl font-bold">Preventivi</h1>
          <p className="mt-1 text-sm text-slate-600">{quote.number ?? "Senza numero"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{QUOTE_STATUS_LABELS[quote.status]}</p>
          <p className="text-slate-500">Emesso: {formatVisitDate(quote.created_at)}</p>
          <p className="text-slate-500">Validità: {formatVisitDate(quote.valid_until)}</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
          <p className="mt-1 text-lg font-semibold">{quote.company_name ?? "—"}</p>
          {quote.contact_name && (
            <p className="text-sm text-slate-600">Referente: {quote.contact_name}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Oggetto</p>
          <p className="mt-1 font-medium">{quote.title}</p>
          <p className="text-sm text-slate-600">
            {PRODUCT_FAMILY_LABELS[quote.product_family]}
          </p>
        </div>
      </div>

      <table className="mb-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left">
            <th className="py-2 pr-2">Prodotto</th>
            <th className="py-2 pr-2">Qtà</th>
            <th className="py-2 pr-2">Prezzo</th>
            <th className="py-2 pr-2">Sconto</th>
            <th className="py-2 pr-2">IVA</th>
            <th className="py-2 text-right">Totale</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-slate-500">
                {quote.product_names.length > 0
                  ? quote.product_names.join(", ")
                  : "Nessuna riga dettaglio"}
              </td>
            </tr>
          ) : (
            quote.lines.map((line, index) => (
              <tr
                key={line.id ?? `${line.productId}-${line.sortOrder}-${index}`}
                className="border-b border-slate-200"
              >
                <td className="py-2 pr-2">
                  <div>{line.productName ?? "—"}</div>
                  {line.description ? (
                    <div className="text-xs text-slate-500">{line.description}</div>
                  ) : null}
                </td>
                <td className="py-2 pr-2">{line.quantity}</td>
                <td className="py-2 pr-2">
                  {formatOpportunityAmount(line.unitPrice, quote.currency)}
                </td>
                <td className="py-2 pr-2">{line.discountPercent}%</td>
                <td className="py-2 pr-2">{line.vatRate}%</td>
                <td className="py-2 text-right">
                  {formatOpportunityAmount(line.lineTotal, quote.currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mb-8 flex justify-end">
        <div className="min-w-[220px] rounded border border-slate-300 px-4 py-3">
          <p className="text-xs uppercase text-slate-500">Totale</p>
          <p className="text-xl font-bold">
            {formatOpportunityAmount(quote.total_amount, quote.currency)}
          </p>
        </div>
      </div>

      {quote.notes && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase text-slate-500">Note</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{quote.notes}</p>
        </div>
      )}

      <div className="print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Stampa / Salva come PDF
        </button>
      </div>
    </div>
  );
}
