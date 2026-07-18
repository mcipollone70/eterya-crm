import Link from "next/link";
import { AlertCircle, Calendar, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  buildCalendarStatusTooltip,
  resolveCalendarIntegrationStatus,
} from "@/lib/integrations/status";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import { GoogleCalendarSettingsActions } from "./google-calendar-settings-actions";

interface GoogleCalendarSettingsPanelProps {
  connection: GoogleCalendarConnectionView;
  configured: boolean;
  redirectUri: string | null;
  flashMessage?: string | null;
  flashError?: string | null;
}

function statusBadge(connection: GoogleCalendarConnectionView) {
  const status = resolveCalendarIntegrationStatus(connection);
  return (
    <Badge variant={status.variant} title={buildCalendarStatusTooltip(connection)}>
      {status.label}
    </Badge>
  );
}

export function GoogleCalendarSettingsPanel({
  connection,
  configured,
  redirectUri,
  flashMessage,
  flashError,
}: GoogleCalendarSettingsPanelProps) {
  const connectHref = "/api/google/calendar/connect";
  const showConnect =
    configured && (!connection.connected || connection.needsReconnect);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Google Calendar
          </CardTitle>
          <p className="text-sm text-slate-500">
            Sincronizzazione bidirezionale: visite, follow-up e promemoria verso Google; eventi
            Google in Agenda come «Evento Google» (senza conversione automatica).
          </p>
        </div>
        {statusBadge(connection)}
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {!configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Integrazione non configurata sul server</p>
            <p className="mt-1">
              Imposta <code className="text-xs">GOOGLE_CLIENT_ID</code>,{" "}
              <code className="text-xs">GOOGLE_CLIENT_SECRET</code> e{" "}
              <code className="text-xs">GOOGLE_OAUTH_REDIRECT_URI</code> nel file{" "}
              <code className="text-xs">.env.local</code> (e su Vercel in produzione).
            </p>
            {redirectUri && (
              <p className="mt-2 text-xs text-amber-800">
                Callback atteso: <span className="font-mono">{redirectUri}</span>
              </p>
            )}
          </div>
        )}

        {flashMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {flashMessage}
          </div>
        )}

        {flashError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {flashError}
          </div>
        )}

        {(connection.connected || connection.needsReconnect) && connection.googleEmail && (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Account collegato</dt>
              <dd className="font-medium text-slate-900">{connection.googleEmail}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ultima sincronizzazione</dt>
              <dd className="font-medium text-slate-900">
                {connection.lastSyncAt
                  ? new Date(connection.lastSyncAt).toLocaleString("it-IT")
                  : "—"}
              </dd>
            </div>
          </dl>
        )}

        {connection.lastSyncError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="font-medium">Ultimo errore</p>
            <p className="mt-1">{connection.lastSyncError}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {showConnect && !connection.connected && (
            <Link href={connectHref} className="block sm:inline-block">
              <Button size="lg" className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4" />
                Collega Google Calendar
              </Button>
            </Link>
          )}

          {(connection.connected || connection.needsReconnect) && (
            <GoogleCalendarSettingsActions needsReconnect={connection.needsReconnect} />
          )}
        </div>

        <p className="text-xs text-slate-500">
          Il CRM resta pienamente utilizzabile anche senza collegamento Google. La sincronizzazione
          avviene in background e non blocca le operazioni sul campo.
        </p>
      </CardContent>
    </Card>
  );
}
