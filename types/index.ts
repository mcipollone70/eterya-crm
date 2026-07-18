export type UserRole = "super_admin" | "org_admin" | "manager" | "agent" | "viewer";

export type ActivityStatus = "todo" | "in_progress" | "done" | "cancelled";
export type ActivityType = "call" | "email" | "task" | "follow_up" | "meeting";

export type VisitStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show";

export type CompanyStatus = "active" | "inactive" | "prospect" | "lead";

export type VoiceMemoStatus = "recorded" | "transcribing" | "transcribed" | "processed";

export type OpportunityStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Company {
  id: string;
  orgId: string;
  name: string;
  vatNumber?: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  status: CompanyStatus;
  latitude: number;
  longitude: number;
  assignedUserId?: string;
  lastVisitDate?: string;
  nextVisitDate?: string;
}

export interface Contact {
  id: string;
  companyId: string;
  fullName: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
}

export interface Activity {
  id: string;
  orgId: string;
  userId: string;
  companyId?: string;
  companyName?: string;
  type: ActivityType;
  title: string;
  description?: string;
  dueAt: string;
  status: ActivityStatus;
  priority: "low" | "medium" | "high";
}

export interface Visit {
  id: string;
  orgId: string;
  companyId: string;
  companyName: string;
  userId: string;
  scheduledAt: string;
  scheduledTime: string;
  status: VisitStatus;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface VoiceMemo {
  id: string;
  orgId: string;
  userId: string;
  companyName?: string;
  title: string;
  duration: string;
  recordedAt: string;
  status: VoiceMemoStatus;
  transcription?: string;
}

export interface DashboardStats {
  totalCompanies: number;
  visitsToday: number;
  activitiesPending: number;
  opportunitiesValue: number;
  conversionRate: number;
  monthlyGrowth: number;
}

export interface MapMarker {
  id: string;
  companyName: string;
  latitude: number;
  longitude: number;
  status: VisitStatus | "pending";
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  /** Etichetta di sezione per il raggruppamento nella sidebar. */
  section?: string;
}
