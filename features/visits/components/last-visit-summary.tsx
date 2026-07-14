import { Badge, Card, CardContent, CardHeader, CardTitle, DescriptionItem, DescriptionList } from "@/components/ui";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import {
  formatDurationMinutes,
  formatLastVisitLabel,
  formatVisitDate,
} from "@/lib/last-visit/format";
import type { Company } from "@/features/companies/services/companies.service";

interface LastVisitSummaryProps {
  company: Company;
  actions?: React.ReactNode;
}

export function LastVisitSummary({ company, actions }: LastVisitSummaryProps) {
  const hasVisit = Boolean(company.last_visit_at);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Ultima visita</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="pt-4">
        {!hasVisit ? (
          <p className="text-sm text-slate-500">Nessuna visita registrata per questa azienda.</p>
        ) : (
          <DescriptionList>
            <DescriptionItem
              label="Data ultima visita"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  {formatVisitDate(company.last_visit_at)}
                  <Badge variant="info">{formatLastVisitLabel(company.last_visit_at)}</Badge>
                </span>
              }
            />
            <DescriptionItem
              label="Esito visita"
              value={getVisitOutcomeLabel(company.last_visit_outcome)}
            />
            <DescriptionItem
              label="Durata visita"
              value={formatDurationMinutes(company.last_visit_duration_minutes)}
            />
            <DescriptionItem
              label="Prossimo richiamo"
              value={formatVisitDate(company.next_callback_at)}
            />
            <DescriptionItem label="Note visita" value={company.last_visit_notes} span />
          </DescriptionList>
        )}
      </CardContent>
    </Card>
  );
}
