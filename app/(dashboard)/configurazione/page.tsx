import { CompanyConfigPage } from "@/features/company-config";
import { assertAdminPageAccess } from "@/features/admin/services/admin-auth.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurazione Azienda" };

export default async function Page() {
  await assertAdminPageAccess();
  return <CompanyConfigPage />;
}
