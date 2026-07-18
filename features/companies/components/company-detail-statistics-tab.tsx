import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, DescriptionItem, DescriptionList } from "@/components/ui";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import { formatVisitDate } from "@/lib/last-visit/format";
import { getCompanyDetailStatistics } from "../services/company-detail.service";

interface CompanyDetailStatisticsTabProps {
  companyId: string;
}

export async function CompanyDetailStatisticsTab({ companyId }: CompanyDetailStatisticsTabProps) {
  const { data: stats, error } = await getCompanyDetailStatistics(companyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistiche commerciali</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}

        <DescriptionList>
          <DescriptionItem label="Numero visite" value={String(stats.visitCount)} />
          <DescriptionItem
            label="Ultima visita"
            value={formatVisitDate(stats.lastVisitAt)}
          />
          <DescriptionItem
            label="Giorni dall'ultima visita"
            value={stats.daysSinceLastVisit != null ? String(stats.daysSinceLastVisit) : "—"}
          />
          <DescriptionItem label="Numero telefonate" value={String(stats.callCount)} />
          <DescriptionItem label="Numero email" value={String(stats.emailCount)} />
          <DescriptionItem
            label="Numero preventivi"
            value={
              stats.quoteCount > 0 ? (
                <Link
                  href={`/preventivi?company=${companyId}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {stats.quoteCount}
                </Link>
              ) : (
                "0"
              )
            }
          />
          <DescriptionItem
            label="Numero ordini"
            value={
              stats.orderCount > 0 ? (
                <Link
                  href={`/ordini?company=${companyId}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {stats.orderCount}
                </Link>
              ) : (
                "0"
              )
            }
          />
          <DescriptionItem
            label="Valore totale ordini"
            value={
              stats.totalOrderValue != null
                ? formatOpportunityAmount(stats.totalOrderValue)
                : "Non disponibile"
            }
            span
          />
        </DescriptionList>
      </CardContent>
    </Card>
  );
}
