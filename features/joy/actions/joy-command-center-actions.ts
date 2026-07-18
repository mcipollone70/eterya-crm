"use server";

import { getCurrentUser } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getJoyCommandCenterSnapshot,
  JOY_OS_VERSION,
  type JoyCommandCenterSnapshot,
} from "@/features/joy/os/joy-os";

export async function fetchJoyCommandCenterSnapshotAction(input?: {
  latitude?: number | null;
  longitude?: number | null;
}): Promise<JoyCommandCenterSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      version: JOY_OS_VERSION,
      narrative: "Database non configurato.",
      syntheticSummary: "Configura Supabase per usare Joy.",
      dayStart: {
        headline: "Inizia la giornata",
        recommendation: "Inizia la giornata",
        followPrompt: "Inizia la giornata",
        organizePrompt: "Organizza il mio giro visite per oggi",
      },
      adviceNow: [],
      prioritiesToday: [],
      freeTime: [],
      nextAction: null,
      strategyChips: [],
      recommendedPrompt: "Inizia la giornata",
      error: "Database non configurato",
    };
  }

  const user = await getCurrentUser();
  return getJoyCommandCenterSnapshot({
    userId: user?.id ?? null,
    latitude: input?.latitude ?? null,
    longitude: input?.longitude ?? null,
    trigger: "day_start",
    hour: new Date().getHours(),
  });
}
