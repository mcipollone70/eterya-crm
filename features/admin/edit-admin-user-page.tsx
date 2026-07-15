import { Shield } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { assertAdminPageAccess } from "./services/admin-auth.service";
import { getUserRoleLabel } from "./constants/user-roles";
import { AdminUserActionsPanel } from "./components/admin-user-actions-panel";
import { EditAdminUserForm } from "./components/admin-user-forms";
import { updateAdminUserAction } from "./actions/admin-user-actions";
import {
  getAdminUserById,
  listAssignableAgents,
} from "./services/admin-users.service";

interface EditAdminUserPageProps {
  userId: string;
  created?: string;
}

export async function EditAdminUserPage({ userId, created }: EditAdminUserPageProps) {
  const currentAdmin = await assertAdminPageAccess();

  const [{ data: user, error }, { data: agents }] = await Promise.all([
    getAdminUserById(userId),
    listAssignableAgents(),
  ]);

  if (error || !user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Utente non trovato" subtitle="Il profilo richiesto non esiste." />
        <EmptyState icon={Shield} title="Utente non trovato" message={error ?? "Profilo assente."} />
      </div>
    );
  }

  const boundUpdate = updateAdminUserAction.bind(null, userId);
  const flashMessage =
    created === "1"
      ? "Utente creato con successo. Comunica la password provvisoria in modo sicuro."
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.fullName || user.email}
        subtitle={user.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={user.isActive ? "success" : "danger"}>
              {user.isActive ? "Attivo" : "Disattivo"}
            </Badge>
            <Badge variant="info">{getUserRoleLabel(user.role)}</Badge>
          </div>
        }
      />

      <EditAdminUserForm
        userId={userId}
        defaults={{
          full_name: user.fullName ?? "",
          role: user.role,
          is_active: user.isActive,
          assigned_companies_count: user.assignedCompaniesCount,
        }}
        agents={agents}
        action={boundUpdate}
        flashMessage={flashMessage}
      />

      <AdminUserActionsPanel
        userId={userId}
        email={user.email}
        isActive={user.isActive}
        isSelf={currentAdmin.id === userId}
      />
    </div>
  );
}
