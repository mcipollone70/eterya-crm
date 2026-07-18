import { AuditLogPage } from "@/features/audit";
import { assertAdminPageAccess } from "@/features/admin/services/admin-auth.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Audit Log" };

export default async function Page() {
  await assertAdminPageAccess();
  return <AuditLogPage />;
}
