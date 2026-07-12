import { DashboardShell } from "@/components/layout";
import { getCurrentUser } from "@/features/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <DashboardShell userEmail={user?.email ?? null}>{children}</DashboardShell>
  );
}
