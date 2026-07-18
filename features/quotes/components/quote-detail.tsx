import Link from "next/link";
import { Building2, Pencil } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import { formatOpportunityAmount, OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quotes";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { QuoteListItem } from "../services/quotes.service";
import { listOpportunityChangeHistory } from "../services/quotes.service";
import { QuoteSendButton } from "./quote-send-button";
import { QuoteActionsPanel } from "./quote-actions-panel";
import { QuoteStatusBadge } from "./quote-status-badge";
import { QuoteStatusActions } from "./quote-status-actions";

interface QuoteDetailProps {
  quote: QuoteListItem;
  companyEmail?: string | null;
}

export async function QuoteDetail({ quote, companyEmail }: QuoteDetailProps) {
  const canSend = quote.status === "draft";
  const history = await listOpportunityChangeHistory(quote.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.title}
        subtitle={quote.company_name ?? "Preventivo commerciale"}
        actions={
          <>
            <Link href={`/preventivi/${quote.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <Link href={`/companies/${quote.company_id}`}>
              <Button variant="outline" size="sm">
                <Building2 className="h-4 w-4" />
                Scheda azienda
              </Button>
            </Link>
            <Link href={`/companies/${quote.company_id}?tab=attivita`}>
              <Button variant="outline" size="sm">
                Cronologia
              </Button>
            </Link>
            <Link href={`/joy-ai?company=${quote.company_id}`}>
              <Button variant="outline" size="sm">
                Joy AI
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Dettaglio preventivo</CardTitle>
            <QuoteStatusBadge status={quote.status} />
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <DescriptionList>
              <DescriptionItem label="Numero" value={quote.number ?? "—"} />
              <DescriptionItem label="Stato" value={QUOTE_STATUS_LABELS[quote.status]} />
              <DescriptionItem
                label="Importo"
                value={formatOpportunityAmount(quote.total_amount, quote.currency)}
              />
              <DescriptionItem
                label="Famiglia prodotto"
                value={PRODUCT_FAMILY_LABELS[quote.product_family]}
              />
              <DescriptionItem
                label="Fase pipeline"
                value={OPPORTUNITY_STAGE_LABELS[quote.stage]}
              />
              <DescriptionItem label="Referente" value={quote.contact_name ?? "—"} />
              <DescriptionItem label="Validità" value={formatVisitDate(quote.valid_until)} />
              <DescriptionItem label="Inviato il" value={formatVisitDate(quote.sent_at)} />
              <DescriptionItem label="Accettato il" value={formatVisitDate(quote.accepted_at)} />
              <DescriptionItem label="Prossima azione" value={quote.next_action ?? "—"} span />
              {quote.notes && <DescriptionItem label="Note" value={quote.notes} span />}
            </DescriptionList>

            {quote.lines.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Righe</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Prodotto</th>
                        <th className="px-3 py-2">Qtà</th>
                        <th className="px-3 py-2">Prezzo</th>
                        <th className="px-3 py-2">Sconto</th>
                        <th className="px-3 py-2">IVA</th>
                        <th className="px-3 py-2 text-right">Totale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quote.lines.map((line, index) => (
                        <tr key={line.id ?? `${line.productId}-${line.sortOrder}-${index}`}>
                          <td className="px-3 py-2">
                            <div>{line.productName ?? line.productId}</div>
                            {line.description ? (
                              <div className="text-xs text-slate-500">{line.description}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{line.quantity}</td>
                          <td className="px-3 py-2">
                            {formatOpportunityAmount(line.unitPrice, quote.currency)}
                          </td>
                          <td className="px-3 py-2">{line.discountPercent}%</td>
                          <td className="px-3 py-2">{line.vatRate}%</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatOpportunityAmount(line.lineTotal, quote.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Azioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {canSend ? (
                <QuoteSendButton quoteId={quote.id} companyId={quote.company_id} />
              ) : null}
              <QuoteStatusActions
                quoteId={quote.id}
                companyId={quote.company_id}
                status={quote.status}
              />
              <QuoteActionsPanel quote={quote} companyEmail={companyEmail} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storico modifiche</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {history.error && (
                <p className="text-sm text-slate-500">
                  Storico non disponibile (esegui la migrazione commerciale se necessario).
                </p>
              )}
              {!history.error && history.data.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">Nessuna modifica registrata.</p>
              )}
              {!history.error && history.data.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {history.data.map((item) => (
                    <li key={item.id} className="py-2 text-sm">
                      <p className="font-medium text-slate-800">
                        {item.notes ?? item.event_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(item.changed_at).toLocaleString("it-IT")}
                        {item.old_value && item.new_value
                          ? ` · ${item.old_value} → ${item.new_value}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
