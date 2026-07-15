import { CreateAdminUserPage } from "@/features/admin";
import { assertAdminPageAccess } from "@/features/admin/services/admin-auth.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuovo utente" };

export default async function Page() {
  await assertAdminPageAccess();
  return <CreateAdminUserPage />;
}
