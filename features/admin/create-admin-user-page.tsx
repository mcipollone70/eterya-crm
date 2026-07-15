import { PageHeader } from "@/components/ui";
import { CreateAdminUserForm } from "./components/admin-user-forms";
import { createAdminUserAction } from "./actions/admin-user-actions";

export function CreateAdminUserPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuovo utente"
        subtitle="Crea un agente o un altro profilo con accesso al CRM."
      />
      <CreateAdminUserForm action={createAdminUserAction} />
    </div>
  );
}
