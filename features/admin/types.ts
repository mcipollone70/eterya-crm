import type { UserRole } from "@/lib/supabase/types";

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  assignedCompaniesCount: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  updatedAt: string;
}

export interface AdminActionResult {
  error?: string;
  message?: string;
}
