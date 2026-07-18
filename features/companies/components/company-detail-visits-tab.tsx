import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { getVisitOutcomeLabel } from "@/lib/constants/last-visit";
import { formatDurationMinutes, formatVisitDate } from "@/lib/last-visit/format";
import { listCompanyVisitsWithContext } from "../services/company-detail.service";

interface CompanyDetailVisitsTabProps {
  companyId: string;
}

function formatVisitTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function CompanyDetailVisitsTab({ companyId }: CompanyDetailVisitsTabProps) {
  const { visits, productNames, saleProbability, error } =
    await listCompanyVisitsWithContext(companyId);

  const completedVisits = visits.filter((visit) => visit.status === "completed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storico visite ({completedVisits.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}

        {completedVisits.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Nessuna visita completata registrata per questa azienda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Ora</th>
                  <th className="px-3 py-2 font-medium">Durata</th>
                  <th className="px-3 py-2 font-medium">Esito</th>
                  <th className="px-3 py-2 font-medium">Prodotti trattati</th>
                  <th className="px-3 py-2 font-medium">Probabilità vendita</th>
                  <th className="px-3 py-2 font-medium">Prossima azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedVisits.map((visit) => {
                  const visitDate = visit.completed_at ?? visit.scheduled_at;
                  return (
                    <tr key={visit.id} className="text-slate-700">
                      <td className="px-3 py-3">{formatVisitDate(visitDate)}</td>
                      <td className="px-3 py-3">{formatVisitTime(visitDate)}</td>
                      <td className="px-3 py-3">
                        {formatDurationMinutes(visit.duration_minutes)}
                      </td>
                      <td className="px-3 py-3">
                        {visit.outcome ? (
                          <Badge variant="default">{getVisitOutcomeLabel(visit.outcome)}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {productNames.length > 0 ? productNames.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {saleProbability != null ? `${saleProbability}%` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {visit.next_callback_at
                          ? formatVisitDate(visit.next_callback_at)
                          : visit.notes?.trim() || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
