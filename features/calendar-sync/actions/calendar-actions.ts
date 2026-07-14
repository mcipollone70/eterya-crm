"use server";

import { revalidatePath } from "next/cache";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConnectionView,
  getGoogleCalendarPublicConfig,
} from "../services/connection.service";
import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";

export interface GoogleCalendarSettingsData {
  connection: GoogleCalendarConnectionView;
  redirectUri: string | null;
  configured: boolean;
}

export async function getGoogleCalendarSettingsAction(): Promise<GoogleCalendarSettingsData> {
  const config = getGoogleCalendarPublicConfig();
  const connection = await getGoogleCalendarConnectionView();

  return {
    connection,
    redirectUri: config.redirectUri,
    configured: config.configured,
  };
}

export async function disconnectGoogleCalendarAction(): Promise<{
  success: boolean;
  message: string;
}> {
  const { error } = await disconnectGoogleCalendar();
  if (error) {
    return { success: false, message: error };
  }

  revalidatePath("/settings");
  revalidatePath("/agenda");
  return { success: true, message: "Google Calendar scollegato." };
}
