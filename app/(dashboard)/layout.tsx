import { DashboardShell } from "@/components/layout";
import { isAdminRole } from "@/features/admin/constants/user-roles";
import { getCurrentUser, getCurrentUserProfile } from "@/features/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentUserProfile()]);
  const showAdminNav = Boolean(profile?.isActive && isAdminRole(profile.role));

  return (
    <DashboardShell userEmail={user?.email ?? null} showAdminNav={showAdminNav}>
      {children}
    </DashboardShell>
  );
}
