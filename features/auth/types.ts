import type { UserRole } from "@/lib/supabase/types";

/** Profilo applicativo sincronizzato con `public.users`. */
export interface AppUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
}
