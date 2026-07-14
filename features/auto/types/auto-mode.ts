import type { GoogleCalendarConnectionView } from "@/lib/google-calendar/types";
import type { VisitCompanyOption } from "@/features/visits/services/visits.service";

export interface AutoModeAppointment {
  visitId: string;
  companyId: string;
  companyName: string;
  city: string | null;
  province: string | null;
  scheduledAt: string;
  scheduledLabel: string;
  phone: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AutoModeData {
  appointment: AutoModeAppointment | null;
  calendar: GoogleCalendarConnectionView;
  companies: VisitCompanyOption[];
  error: string | null;
}
