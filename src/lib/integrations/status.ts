import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";

/** Estendibile a Gmail / Drive / Outlook senza cambiare i consumer dei badge. */
export type IntegrationProviderId = "calendar" | "gmail" | "drive" | "outlook";

export type IntegrationStatusKind =
  | "connected"
  | "not_configured"
  | "needs_reconnect"
  | "syncing"
  | "temporary_error"
  | "sync_error";

export type CrmStatusKind = "operational" | "down";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "muted" | "default" | "info";

export interface StatusBadgeModel {
  kind: IntegrationStatusKind | CrmStatusKind;
  label: string;
  variant: StatusBadgeVariant;
}

const INTEGRATION_VARIANTS: Record<IntegrationStatusKind, StatusBadgeVariant> = {
  connected: "success",
  not_configured: "muted",
  needs_reconnect: "warning",
  syncing: "info",
  temporary_error: "warning",
  sync_error: "danger",
};

const CALENDAR_LABELS: Record<IntegrationStatusKind, string> = {
  connected: "🟢 Calendar sincronizzato",
  not_configured: "🟡 Calendar non configurato",
  needs_reconnect: "🟠 Calendar da riconnettere",
  syncing: "🔵 Calendar sync in corso",
  temporary_error: "🟠 Calendar errore temporaneo",
  sync_error: "🔴 Errore sincronizzazione Calendar",
};

export function resolveCrmStatus(operational: boolean): StatusBadgeModel {
  if (operational) {
    return { kind: "operational", label: "🟢 CRM operativo", variant: "success" };
  }
  return { kind: "down", label: "🔴 CRM non operativo", variant: "danger" };
}

/**
 * Stato integrazione Calendar (opzionale).
 * Non influenza lo stato CRM.
 */
export function resolveCalendarIntegrationStatus(
  calendar: Pick<
    GoogleCalendarConnectionView,
    | "configured"
    | "connected"
    | "needsReconnect"
    | "lastSyncError"
    | "syncInProgress"
    | "temporaryError"
  >
): StatusBadgeModel {
  if (calendar.needsReconnect) {
    return {
      kind: "needs_reconnect",
      label: CALENDAR_LABELS.needs_reconnect,
      variant: INTEGRATION_VARIANTS.needs_reconnect,
    };
  }

  if (calendar.syncInProgress) {
    return {
      kind: "syncing",
      label: CALENDAR_LABELS.syncing,
      variant: INTEGRATION_VARIANTS.syncing,
    };
  }

  if (!calendar.configured || !calendar.connected) {
    return {
      kind: "not_configured",
      label: CALENDAR_LABELS.not_configured,
      variant: INTEGRATION_VARIANTS.not_configured,
    };
  }

  if (calendar.temporaryError) {
    return {
      kind: "temporary_error",
      label: CALENDAR_LABELS.temporary_error,
      variant: INTEGRATION_VARIANTS.temporary_error,
    };
  }

  if (calendar.lastSyncError) {
    return {
      kind: "sync_error",
      label: CALENDAR_LABELS.sync_error,
      variant: INTEGRATION_VARIANTS.sync_error,
    };
  }

  return {
    kind: "connected",
    label: CALENDAR_LABELS.connected,
    variant: INTEGRATION_VARIANTS.connected,
  };
}

export function buildCalendarStatusTooltip(
  calendar: Pick<
    GoogleCalendarConnectionView,
    "googleEmail" | "lastSyncAt" | "lastSyncError" | "needsReconnect" | "connected"
  >
): string {
  const lines: string[] = [];
  if (calendar.googleEmail) {
    lines.push(`Account: ${calendar.googleEmail}`);
  }
  lines.push(
    calendar.lastSyncAt
      ? `Ultima sync: ${new Date(calendar.lastSyncAt).toLocaleString("it-IT")}`
      : "Ultima sync: —"
  );
  if (calendar.lastSyncError) {
    lines.push(`Errore: ${calendar.lastSyncError}`);
  }
  if (calendar.needsReconnect) {
    lines.push("Azione: Ricollega da Impostazioni");
  } else if (calendar.connected) {
    lines.push("Azioni: Sincronizza ora / Scollega in Impostazioni");
  }
  return lines.join("\n");
}
