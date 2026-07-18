import { BackupPage } from "@/features/backup";
import { assertAdminPageAccess } from "@/features/admin/services/admin-auth.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Backup e Ripristino" };

export default async function Page() {
  await assertAdminPageAccess();
  return <BackupPage />;
}
