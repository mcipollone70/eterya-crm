import "server-only";

import { getCurrentUser } from "@/features/auth/session";
import { getGoogleCalendarConnectionView } from "@/features/calendar-sync/services/connection.service";
import { listVisitCompanyOptions } from "@/features/visits/services/visits.service";
import { startOfTodayIso } from "@/lib/last-visit/format";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { AutoModeAppointment, AutoModeData } from "../types/auto-mode";

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getNextAutoAppointment(userId: string | null): Promise<AutoModeAppointment | null> {
  const supabase = await createServerClient();
  const todayStart = startOfTodayIso();

  type VisitNextRow = {
    id: string;
    company_id: string;
    scheduled_at: string;
    notes: string | null;
    companies:
      | {
          name: string;
          city: string | null;
          province: string | null;
          phone: string | null;
          contact_phone: string | null;
          mobile: string | null;
          latitude: number | null;
          longitude: number | null;
        }
      | Array<{
          name: string;
          city: string | null;
          province: string | null;
          phone: string | null;
          contact_phone: string | null;
          mobile: string | null;
          latitude: number | null;
          longitude: number | null;
        }>
      | null;
  };

  let query = supabase
    .from("visits")
    .select(
      "id,company_id,scheduled_at,notes,companies(name,city,province,phone,contact_phone,mobile,latitude,longitude)"
    )
    .in("status", ["scheduled", "in_progress"])
    .gte("scheduled_at", todayStart)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  const row = (data as VisitNextRow[] | null)?.[0];
  if (error || !row) {
    return null;
  }

  const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  const phone = company?.phone ?? company?.contact_phone ?? company?.mobile ?? null;

  return {
    visitId: row.id,
    companyId: row.company_id,
    companyName: company?.name ?? "Azienda",
    city: company?.city ?? null,
    province: company?.province ?? null,
    scheduledAt: row.scheduled_at,
    scheduledLabel: formatTimeLabel(row.scheduled_at),
    phone,
    notes: row.notes,
    latitude: company?.latitude ?? null,
    longitude: company?.longitude ?? null,
  };
}

export async function getAutoModeData(): Promise<AutoModeData> {
  const user = await getCurrentUser();
  const userId = user?.id ?? null;

  try {
    const [calendar, appointment, companiesResult] = await Promise.all([
      getGoogleCalendarConnectionView(),
      getNextAutoAppointment(userId),
      listVisitCompanyOptions(),
    ]);

    return {
      appointment,
      calendar,
      companies: companiesResult.data ?? [],
      error: companiesResult.error,
    };
  } catch (error) {
    return {
      appointment: null,
      calendar: await getGoogleCalendarConnectionView(),
      companies: [],
      error: error instanceof Error ? error.message : "Impossibile caricare la modalità auto.",
    };
  }
}
