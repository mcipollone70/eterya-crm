import { isAdminRole } from "@/features/admin/constants/user-roles";
import { getCurrentUserProfile } from "@/features/auth/session";
import { ManualePage } from "@/features/manuale";

export const metadata = {
  title: "Manuale Operativo CRM Eterya",
};

export default async function Page() {
  const profile = await getCurrentUserProfile();
  const isAdmin = Boolean(profile?.isActive && isAdminRole(profile.role));

  return <ManualePage isAdmin={isAdmin} />;
}
