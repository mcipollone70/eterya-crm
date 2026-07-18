import Link from "next/link";
import { Building2, Package, Pencil } from "lucide-react";
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
import { SAMPLE_STATUS_LABELS } from "@/lib/constants/samples";
import { formatVisitDate } from "@/lib/last-visit/format";
import { deleteSampleAction } from "../actions/sample-actions";
import type { SampleListItem } from "../services/samples.service";

interface SampleDetailProps {
  sample: SampleListItem;
}

export function SampleDetail({ sample }: SampleDetailProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={sample.title}
        subtitle={sample.company_name ?? "Campione prodotto"}
        actions={
          <>
            <Link href={`/campioni/${sample.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4" />
                Modifica
              </Button>
            </Link>
            <Link href={`/companies/${sample.company_id}`}>
              <Button variant="outline" size="sm">
                <Building2 className="h-4 w-4" />
                Scheda azienda
              </Button>
            </Link>
            <Link href={`/companies/${sample.company_id}?tab=attivita`}>
              <Button variant="outline" size="sm">
                Cronologia
              </Button>
            </Link>
            {sample.product_id && (
              <Link href={`/products/${sample.product_id}`}>
                <Button variant="ghost" size="sm">
                  <Package className="h-4 w-4" />
                  Prodotto
                </Button>
              </Link>
            )}
            <DeleteButton
              action={deleteSampleAction.bind(null, sample.id, sample.company_id)}
              confirmMessage={`Eliminare il campione "${sample.title}"?`}
            />
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio campione</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DescriptionList>
            <DescriptionItem label="Stato" value={SAMPLE_STATUS_LABELS[sample.status]} />
            <DescriptionItem label="Quantità" value={String(sample.quantity)} />
            <DescriptionItem label="Prodotto" value={sample.product_name ?? "—"} />
            <DescriptionItem label="Referente" value={sample.contact_name ?? "—"} />
            <DescriptionItem label="Data consegna" value={formatVisitDate(sample.given_at)} />
            <DescriptionItem
              label="Rientro previsto"
              value={formatVisitDate(sample.expected_return_at)}
            />
            <DescriptionItem label="Rientrato il" value={formatVisitDate(sample.returned_at)} />
            {sample.notes && <DescriptionItem label="Note" value={sample.notes} span />}
          </DescriptionList>
        </CardContent>
      </Card>
    </div>
  );
}
