import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminUsersTable, AdminUserQuickActionsHint } from "./components/admin-users-table";
import { listAdminUsers } from "./services/admin-users.service";

function CreateCta() {
  return (
    <Link
      href="/admin/users/new"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
    >
      <Plus className="h-4 w-4" />
      Nuovo utente
    </Link>
  );
}

export async function AdminUsersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Amministrazione utenti"
          subtitle="Gestisci agenti e accessi al CRM."
        />
        <EmptyState
          icon={Shield}
          title="Database non configurato"
          message="Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
        />
      </div>
    );
  }

  if (!isAdminClientConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Amministrazione utenti"
          subtitle="Gestisci agenti e accessi al CRM."
          actions={<CreateCta />}
        />
        <EmptyState
          icon={Shield}
          title="Service role non configurata"
          message="Per creare utenti e bloccare gli accessi aggiungi SUPABASE_SERVICE_ROLE_KEY in .env.local (solo server, mai nel client)."
        />
      </div>
    );
  }

  const { data: users, error } = await listAdminUsers();

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Amministrazione utenti"
          subtitle="Gestisci agenti e accessi al CRM."
          actions={<CreateCta />}
        />
        <EmptyState icon={Shield} title="Impossibile caricare gli utenti" message={error} />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Amministrazione utenti"
          subtitle="Nessun utente nel database."
          actions={<CreateCta />}
        />
        <EmptyState
          icon={Shield}
          title="Nessun utente"
          message="Crea il primo agente con email, ruolo e password provvisoria."
          action={<CreateCta />}
        />
      </div>
    );
  }

  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Amministrazione utenti"
        subtitle={`${users.length} utenti · ${activeCount} attivi`}
        actions={<CreateCta />}
      />

      <AdminUserQuickActionsHint />

      <Card>
        <CardContent className="p-0">
          <AdminUsersTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
