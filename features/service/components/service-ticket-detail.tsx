import Link from "next/link";
import { Building2, Package, Pencil, ShoppingCart } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DeleteButton,
  DescriptionItem,
  DescriptionList,
  PageHeader,
} from "@/components/ui";
import {
  getServiceTicketCategoryLabel,
  SERVICE_TICKET_PRIORITY_LABELS,
  SERVICE_TICKET_STATUS_LABELS,
} from "@/lib/constants/service-tickets";
import { formatVisitDate } from "@/lib/last-visit/format";
import { deleteServiceTicketAction } from "../actions/service-ticket-actions";
import type { ServiceTicketListItem } from "../services/service-tickets.service";

interface ServiceTicketDetailProps {
  ticket: ServiceTicketListItem;
}

export function ServiceTicketDetail({ ticket }: ServiceTicketDetailProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.title}
        subtitle={ticket.company_name ?? "Ticket di assistenza"}
        actions={
          <>
            <Link href={`/assistenza/${ticket.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <Link href={`/companies/${ticket.company_id}`}>
              <Button variant="outline" size="sm">
                <Building2 className="h-4 w-4" />
                Scheda azienda
              </Button>
            </Link>
            <Link href={`/companies/${ticket.company_id}?tab=attivita`}>
              <Button variant="outline" size="sm">
                Cronologia
              </Button>
            </Link>
            {ticket.product_id && (
              <Link href={`/products/${ticket.product_id}`}>
                <Button variant="ghost" size="sm">
                  <Package className="h-4 w-4" />
                  Prodotto
                </Button>
              </Link>
            )}
            {ticket.order_id && (
              <Link href={`/ordini/${ticket.order_id}`}>
                <Button variant="ghost" size="sm">
                  <ShoppingCart className="h-4 w-4" />
                  Ordine
                </Button>
              </Link>
            )}
            <DeleteButton
              action={deleteServiceTicketAction.bind(null, ticket.id, ticket.company_id)}
              confirmMessage={`Eliminare il ticket "${ticket.title}"?`}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio ticket</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem label="Numero" value={ticket.number ?? "—"} />
            <DescriptionItem label="Stato" value={SERVICE_TICKET_STATUS_LABELS[ticket.status]} />
            <DescriptionItem
              label="Categoria"
              value={getServiceTicketCategoryLabel(ticket.category)}
            />
            <DescriptionItem
              label="Priorità"
              value={SERVICE_TICKET_PRIORITY_LABELS[ticket.priority]}
            />
            <DescriptionItem label="Prodotto" value={ticket.product_name ?? "—"} />
            <DescriptionItem
              label="Ordine collegato"
              value={
                ticket.order_id ? (
                  <Link href={`/ordini/${ticket.order_id}`} className="text-indigo-600 hover:underline">
                    Apri ordine
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <DescriptionItem label="Referente" value={ticket.contact_name ?? "—"} />
            <DescriptionItem label="Apertura" value={formatVisitDate(ticket.opened_at)} />
            <DescriptionItem
              label="Intervento programmato"
              value={formatVisitDate(ticket.scheduled_at)}
            />
            <DescriptionItem label="Risolto il" value={formatVisitDate(ticket.resolved_at)} />
            <DescriptionItem label="Chiuso il" value={formatVisitDate(ticket.closed_at)} />
            {ticket.description && (
              <DescriptionItem label="Descrizione" value={ticket.description} span />
            )}
            {ticket.resolution && (
              <DescriptionItem label="Risoluzione" value={ticket.resolution} span />
            )}
          </DescriptionList>
        </CardContent>
      </Card>
    </div>
  );
}
