import Link from "next/link";
import { Building2, Pencil } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import {
  ORDER_FULFILLMENT_STATUS_LABELS,
  orderStatusVariant,
} from "@/lib/constants/orders";
import { formatVisitDate } from "@/lib/last-visit/format";
import type { OrderListItem } from "../services/orders.service";
import { OrderStatusActions } from "./order-status-actions";

interface OrderDetailProps {
  order: OrderListItem;
}

export function OrderDetail({ order }: OrderDetailProps) {
  const status = order.order_status;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.title}
        subtitle={order.company_name ?? "Ordine commerciale"}
        actions={
          <>
            <Link href={`/ordini/${order.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <Link href={`/ordini/${order.id}/stampa`} target="_blank">
              <Button variant="outline" size="sm">
                Stampa / PDF
              </Button>
            </Link>
            <Link href={`/companies/${order.company_id}`}>
              <Button variant="outline" size="sm">
                <Building2 className="h-4 w-4" />
                Scheda azienda
              </Button>
            </Link>
            <Link href={`/companies/${order.company_id}?tab=attivita`}>
              <Button variant="outline" size="sm">
                Cronologia
              </Button>
            </Link>
            <Link href={`/joy-ai?company=${order.company_id}`}>
              <Button variant="outline" size="sm">
                Joy AI
              </Button>
            </Link>
            {order.converted_from_id ? (
              <Link href={`/preventivi/${order.converted_from_id}`}>
                <Button variant="ghost" size="sm">
                  Preventivo origine
                </Button>
              </Link>
            ) : null}
            <Link href={`/assistenza/new?company=${order.company_id}&order=${order.id}`}>
              <Button variant="ghost" size="sm">
                Ticket assistenza
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Dettaglio ordine</CardTitle>
            {status && (
              <Badge variant={orderStatusVariant(status)}>
                {ORDER_FULFILLMENT_STATUS_LABELS[status]}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <DescriptionList>
              <DescriptionItem label="Numero ordine" value={order.number ?? "—"} />
              <DescriptionItem
                label="Stato evasione"
                value={status ? ORDER_FULFILLMENT_STATUS_LABELS[status] : "—"}
              />
              <DescriptionItem
                label="Importo"
                value={formatOpportunityAmount(order.total_amount, order.currency)}
              />
              <DescriptionItem label="Data ordine" value={formatVisitDate(order.order_date ?? order.accepted_at)} />
              <DescriptionItem
                label="Consegna prevista"
                value={formatVisitDate(order.expected_delivery_at)}
              />
              <DescriptionItem
                label="Famiglia prodotto"
                value={PRODUCT_FAMILY_LABELS[order.product_family]}
              />
              <DescriptionItem label="Referente" value={order.contact_name ?? "—"} />
              <DescriptionItem label="Prossima azione" value={order.next_action ?? "—"} span />
              {order.notes && <DescriptionItem label="Note" value={order.notes} span />}
            </DescriptionList>

            {order.lines.length > 0 && (
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
                      {order.lines.map((line, index) => (
                        <tr key={line.id ?? `${line.productId}-${line.sortOrder}-${index}`}>
                          <td className="px-3 py-2">
                            <div>{line.productName ?? line.productId}</div>
                            {line.description ? (
                              <div className="text-xs text-slate-500">{line.description}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{line.quantity}</td>
                          <td className="px-3 py-2">
                            {formatOpportunityAmount(line.unitPrice, order.currency)}
                          </td>
                          <td className="px-3 py-2">{line.discountPercent}%</td>
                          <td className="px-3 py-2">{line.vatRate}%</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatOpportunityAmount(line.lineTotal, order.currency)}
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

        <Card>
          <CardHeader>
            <CardTitle>Avanzamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <OrderStatusActions
              orderId={order.id}
              companyId={order.company_id}
              status={status}
            />
            <Link
              href={`/ordini/${order.id}/edit`}
              className="inline-block text-sm text-indigo-600 hover:underline"
            >
              Modifica ordine completa
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
