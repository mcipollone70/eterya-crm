"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { disconnectGoogleCalendarAction } from "../actions/calendar-actions";

export function GoogleCalendarSettingsActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDisconnect() {
    if (!window.confirm("Scollegare Google Calendar? Gli eventi già esportati non verranno rimossi da Google.")) {
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
  );
}
