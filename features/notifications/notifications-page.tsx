import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Boxes,
  FileText,
  LifeBuoy,
  Target,
} from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getIntelligentNotifications,
  type IntelligentNotification,
  type NotificationCategory,
} from "./services/notifications.service";

const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  follow_up: AlertTriangle,
  opportunity: Target,
  quote: FileText,
  sample: Boxes,
  service: LifeBuoy,
};

const SEVERITY_VARIANT = {
  high: "danger",
  medium: "warning",
  low: "muted",
} as const;

const SEVERITY_LABEL = {
  high: "Urgente",
  medium: "Media",
  low: "Bassa",
} as const;

function NotificationRow({ notification }: { notification: IntelligentNotification }) {
  const Icon = CATEGORY_ICONS[notification.category];
  return (
    <Link
      href={notification.href}
      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{notification.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{notification.description}</p>
      </div>
      <Badge variant={SEVERITY_VARIANT[notification.severity]}>
        {SEVERITY_LABEL[notification.severity]}
      </Badge>
    </Link>
  );
}

export async function NotificationsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifiche intelligenti" subtitle="Avvisi operativi dai moduli commerciali." />
        <EmptyState
          icon={Bell}
          title="Database non configurato"
          message="Configura Supabase in .env.local per ricevere le notifiche intelligenti."
        />
      </div>
    );
  }

  const { notifications, counts, error } = await getIntelligentNotifications();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifiche intelligenti"
        subtitle={`${counts.total.toLocaleString("it-IT")} avvisi · ${counts.high} urgenti`}
      />

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alcuni dati potrebbero essere incompleti: {error}
        </p>
      ) : null}

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Tutto sotto controllo"
          message="Nessun avviso operativo: follow-up, opportunità, preventivi, campioni e assistenza sono in regola."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
