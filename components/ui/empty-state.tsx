import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
}

/** Card di stato vuoto/errore condivisa (elenco vuoto, DB non configurato, ...). */
export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <Icon className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}
