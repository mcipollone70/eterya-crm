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
import { BrandBadges } from "@/features/brands/components/brand-badges";
import { listCompanyBrands } from "@/features/brands/services/company-brands.service";
import type { BrandAssociationView } from "@/features/brands/utils/brand-shared";
import { BRAND_RELATIONSHIP_STATUS_LABELS } from "@/lib/constants/brand-relationship";

interface ContactDetailProps {
  contact: Contact & { company: { name: string } | null };
}

export async function ContactDetail({ contact }: ContactDetailProps) {
  const brandsResult = await listCompanyBrands(contact.company_id);
  const brands: BrandAssociationView[] = brandsResult.data.map((item) => ({
    brand_id: item.brand_id,
    name: item.brand_name,
    slug: item.brand_slug,
    color: item.brand_color,
    is_primary: item.is_primary,
    relationship_status: item.relationship_status,
    customer_code: item.customer_code,
  }));

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
            <DescriptionItem
              label="Brand azienda"
              value={
                brands.length === 0 ? (
                  <span className="text-slate-400">Nessun brand</span>
                ) : (
                  <div className="space-y-2">
                    <BrandBadges brands={brands} showStatus />
                    <ul className="space-y-1 text-xs text-slate-600">
                      {brands.map((brand) => (
                        <li key={brand.brand_id}>
                          <span className="font-medium">{brand.name}</span>
                          {" · "}
                          {BRAND_RELATIONSHIP_STATUS_LABELS[brand.relationship_status]}
                          {brand.is_primary ? " · Principale" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
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
