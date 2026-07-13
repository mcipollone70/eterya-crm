import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  COMPANY_FIELD_LABELS,
  MAPPABLE_FIELDS,
  type ColumnMapping,
  type MappingConfidence,
} from "../../../types/import";

interface StepMappingProps {
  mappings: ColumnMapping[];
  onMappingChange: (columnIndex: number, field: ColumnMapping["mappedField"]) => void;
}

const confidenceVariant: Record<MappingConfidence, "success" | "info" | "warning" | "muted"> = {
  high: "success",
  medium: "info",
  low: "warning",
  manual: "muted",
};

const confidenceLabel: Record<MappingConfidence, string> = {
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  manual: "Manuale",
};

export function StepMapping({ mappings, onMappingChange }: StepMappingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapping intelligente delle colonne</CardTitle>
        <p className="text-xs text-slate-500">
          Ogni colonna è associata al campo CRM in base al nome dell&apos;intestazione Excel.
          Verifica o modifica le associazioni qui sotto.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Colonna Excel</th>
                <th className="px-3 py-2 font-medium">Campo CRM</th>
                <th className="px-3 py-2 font-medium">Affidabilità</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr
                  key={mapping.columnIndex}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-3 font-medium text-slate-900">
                    {mapping.sourceHeader}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={mapping.mappedField}
                      onChange={(e) =>
                        onMappingChange(
                          mapping.columnIndex,
                          e.target.value as ColumnMapping["mappedField"]
                        )
                      }
                      className="h-9 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      {MAPPABLE_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {COMPANY_FIELD_LABELS[field]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={confidenceVariant[mapping.confidence]}>
                      {confidenceLabel[mapping.confidence]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
