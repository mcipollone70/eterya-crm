import Link from "next/link";
import { Check, Minus, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import {
  getRoleLabel,
  PERMISSION_AREAS,
  PERMISSION_MATRIX_ROLES,
  roleHasPermission,
} from "@/lib/constants/permissions";

export function AdminPermissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ruoli e permessi"
        subtitle="Matrice delle capacità per ruolo. I permessi sono applicati in base al ruolo assegnato a ciascun utente."
        actions={
          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Users className="h-4 w-4" />
            Gestione utenti
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Matrice permessi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Area</th>
                  {PERMISSION_MATRIX_ROLES.map((role) => (
                    <th key={role} className="px-3 py-3 text-center font-medium text-slate-600">
                      {getRoleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSION_AREAS.map((area) => (
                  <tr key={area.key} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{area.label}</p>
                      <p className="text-xs text-slate-500">{area.description}</p>
                    </td>
                    {PERMISSION_MATRIX_ROLES.map((role) => (
                      <td key={role} className="px-3 py-3 text-center">
                        {roleHasPermission(area, role) ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">
        Per modificare il ruolo di un utente apri Gestione utenti e scegli il ruolo dalla scheda
        di modifica. I permessi non sono configurabili singolarmente: derivano dal ruolo.
      </p>
    </div>
  );
}
