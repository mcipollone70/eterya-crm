"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import {
  disconnectGoogleCalendarAction,
  syncGoogleCalendarNowAction,
} from "../actions/calendar-actions";

interface GoogleCalendarSettingsActionsProps {
  needsReconnect?: boolean;
}

export function GoogleCalendarSettingsActions({
  needsReconnect = false,
}: GoogleCalendarSettingsActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSyncNow() {
    startTransition(async () => {
      const result = await syncGoogleCalendarNowAction();
      if (!result.success) {
        window.alert(result.message);
      }
      router.refresh();
    });
  }

  function handleDisconnect() {
    if (
      !window.confirm(
        "Scollegare Google Calendar? Gli eventi già esportati non verranno rimossi da Google. Gli «Eventi Google» importati spariranno dall'Agenda."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await disconnectGoogleCalendarAction();
      if (result.success) {
        router.refresh();
      } else {
        window.alert(result.message);
      }
    });
  }

  return (
    <>
      {!needsReconnect && (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={isPending}
          onClick={handleSyncNow}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizza ora
        </Button>
      )}

      {needsReconnect && (
        <Link href="/api/google/calendar/connect" className="block sm:inline-block">
          <Button size="lg" className="w-full sm:w-auto" disabled={isPending}>
            <RefreshCw className="h-4 w-4" />
            Ricollega Google Calendar
          </Button>
        </Link>
      )}

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full sm:w-auto"
        disabled={isPending}
        onClick={handleDisconnect}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
        Scollega
      </Button>
    </>
  );
}
