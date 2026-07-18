import Link from "next/link";
import { FileText, Package, ShoppingCart, Wrench } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ContactListItem } from "@/features/contacts/services/contacts.service";
import { CompanyOpportunitiesSection } from "@/features/opportunities/components/company-opportunities-section";
import { CompanyFollowUpsSection } from "@/features/activities/components/company-follow-ups-section";
import { listQuotes } from "@/features/quotes/services/quotes.service";
import { listOrders } from "@/features/orders/services/orders.service";
import { listSamples } from "@/features/samples/services/samples.service";
import { listServiceTickets } from "@/features/service/services/service-tickets.service";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { QUOTE_STATUS_LABELS } from "@/lib/constants/quotes";
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
} from "@/lib/constants/orders";
import { SAMPLE_STATUS_LABELS } from "@/lib/constants/samples";
import { SERVICE_TICKET_STATUS_LABELS } from "@/lib/constants/service-tickets";

interface CompanyDetailCommercialTabProps {
  companyId: string;
  contacts: ContactListItem[];
}

export async function CompanyDetailCommercialTab({
  companyId,
  contacts,
}: CompanyDetailCommercialTabProps) {
  const [quotesResult, ordersResult, samplesResult, ticketsResult] = await Promise.all([
    listQuotes({ filters: { companyId }, limit: 20, includeWon: true }),
    listOrders({ filters: { companyId }, limit: 20 }),
    listSamples({ filters: { companyId }, limit: 20 }),
    listServiceTickets({ filters: { companyId }, limit: 20 }),
  ]);

  const openQuotes = quotesResult.data.filter((item) => item.stage !== "won");
  const orders = ordersResult.data;
  const samples = samplesResult.data ?? [];
  const tickets = ticketsResult.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href={`/preventivi/new?company=${companyId}`}>
          <Button size="sm" variant="outline">
            <FileText className="h-4 w-4" />
            Nuovo preventivo
          </Button>
        </Link>
        <Link href={`/ordini/new?company=${companyId}`}>
          <Button size="sm" variant="outline">
            <ShoppingCart className="h-4 w-4" />
            Nuovo ordine
          </Button>
        </Link>
        <Link href={`/campioni/new?company=${companyId}`}>
          <Button size="sm" variant="outline">
            <Package className="h-4 w-4" />
            Nuovo campione
          </Button>
        </Link>
        <Link href={`/assistenza/new?company=${companyId}`}>
          <Button size="sm" variant="outline">
            <Wrench className="h-4 w-4" />
            Nuovo ticket
          </Button>
        </Link>
        <Link href={`/joy-ai?company=${companyId}`}>
          <Button size="sm" variant="outline">
            Joy AI
          </Button>
        </Link>
      </div>

      <CompanyOpportunitiesSection companyId={companyId} contacts={contacts} />
      <CompanyFollowUpsSection companyId={companyId} contacts={contacts} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Preventivi ({openQuotes.length})</CardTitle>
          <Link href={`/preventivi?company=${companyId}`} className="text-xs text-indigo-600 hover:underline">
            Vedi tutti
          </Link>
        </CardHeader>
        <CardContent className="pt-2">
          {quotesResult.error && <p className="text-sm text-rose-700">{quotesResult.error}</p>}
          {openQuotes.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nessun preventivo aperto.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openQuotes.map((quote) => (
                <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{quote.title}</p>
                    <p className="text-xs text-slate-500">
                      {quote.number ?? "Senza n."} · {QUOTE_STATUS_LABELS[quote.status]} ·{" "}
                      {formatOpportunityAmount(quote.total_amount, quote.currency)}
                    </p>
                  </div>
                  <Link href={`/preventivi/${quote.id}`} className="text-xs font-medium text-indigo-600">
                    Apri
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ordini ({orders.length})</CardTitle>
          <Link href={`/ordini?company=${companyId}`} className="text-xs text-indigo-600 hover:underline">
            Vedi tutti
          </Link>
        </CardHeader>
        <CardContent className="pt-2">
          {ordersResult.error && <p className="text-sm text-rose-700">{ordersResult.error}</p>}
          {orders.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nessun ordine.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{order.title}</p>
                    <p className="text-xs text-slate-500">
                      {order.number ?? "Senza n."} ·{" "}
                      {order.order_status
                        ? ORDER_FULFILLMENT_STATUS_LABELS[order.order_status]
                        : "—"}{" "}
                      · {formatOpportunityAmount(order.total_amount, order.currency)}
                    </p>
                  </div>
                  <Link href={`/ordini/${order.id}`} className="text-xs font-medium text-indigo-600">
                    Apri
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Campioni ({samples.length})</CardTitle>
            <Link href={`/campioni?company=${companyId}`} className="text-xs text-indigo-600 hover:underline">
              Vedi tutti
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            {samplesResult.error && (
              <p className="text-sm text-rose-700">{samplesResult.error}</p>
            )}
            {!samplesResult.error && samples.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Nessun campione.</p>
            ) : null}
            {!samplesResult.error && samples.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {samples.slice(0, 5).map((sample) => (
                  <li key={sample.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{sample.title}</p>
                      <p className="text-xs text-slate-500">
                        {SAMPLE_STATUS_LABELS[sample.status]}
                      </p>
                    </div>
                    <Link href={`/campioni/${sample.id}`} className="text-xs font-medium text-indigo-600">
                      Apri
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Assistenza ({tickets.length})</CardTitle>
            <Link href={`/assistenza?company=${companyId}`} className="text-xs text-indigo-600 hover:underline">
              Vedi tutti
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            {ticketsResult.error && (
              <p className="text-sm text-rose-700">{ticketsResult.error}</p>
            )}
            {!ticketsResult.error && tickets.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Nessun ticket.</p>
            ) : null}
            {!ticketsResult.error && tickets.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {tickets.slice(0, 5).map((ticket) => (
                  <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{ticket.title}</p>
                      <p className="text-xs text-slate-500">
                        {SERVICE_TICKET_STATUS_LABELS[ticket.status]}
                      </p>
                    </div>
                    <Link href={`/assistenza/${ticket.id}`} className="text-xs font-medium text-indigo-600">
                      Apri
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
