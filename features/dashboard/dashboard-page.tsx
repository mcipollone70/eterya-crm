import Link from "next/link";
import { FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/cn";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Benvenuto in Eterya CRM. Inizia importando le tue aziende da Excel.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <LayoutDashboard className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Nessun dato disponibile
          </h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Il CRM è pronto. Importa il tuo elenco aziende da un file Excel per
            iniziare a lavorare con dati reali.
          </p>
          <Link
            href="/companies/import"
            className={cn(
              "mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importa Aziende
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
