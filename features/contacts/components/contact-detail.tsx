import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  Badge,
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
import { deleteContactAction } from "../actions/contact-mutations";
import type { Contact } from "../services/contacts.service";

interface ContactDetailProps {
  contact: Contact & { company: { name: string } | null };
}

export function ContactDetail({ contact }: ContactDetailProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={contact.full_name}
        subtitle={contact.company?.name ?? "Dettaglio contatto"}
        actions={
          <>
            <Link href={`/contacts/${contact.id}/edit`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <DeleteButton
              action={deleteContactAction.bind(null, contact.id, contact.company_id)}
              confirmMessage={`Eliminare il contatto "${contact.full_name}"?`}
            />
          </>
        }
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Referente</CardTitle>
          {contact.is_primary && <Badge variant="info">Referente principale</Badge>}
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem
              label="Azienda"
              value={
                <Link
                  href={`/companies/${contact.company_id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {contact.company?.name ?? "—"}
                </Link>
              }
              span
            />
            <DescriptionItem label="Ruolo" value={contact.role} />
            <DescriptionItem
              label="Email"
              value={
                contact.email ? (
                  <a className="text-indigo-600 hover:underline" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                ) : null
              }
            />
            <DescriptionItem label="Telefono" value={contact.phone} />
            <DescriptionItem label="Cellulare" value={contact.mobile} />
            <DescriptionItem label="Note" value={contact.notes} span />
          </DescriptionList>
        </CardContent>
      </Card>
    </div>
  );
}
