import { AdminUsersPage } from "@/features/admin";
import { assertAdminPageAccess } from "@/features/admin/services/admin-auth.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Amministrazione utenti" };

export default async function Page() {
  await assertAdminPageAccess();
  return <AdminUsersPage />;
}
