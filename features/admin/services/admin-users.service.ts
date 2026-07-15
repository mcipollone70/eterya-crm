import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError, isServiceRoleGrantError } from "@/lib/supabase/errors";
import type { Database, UserRole } from "@/lib/supabase/types";
import { getAuthAppBaseUrl } from "@/features/auth/utils/app-url";
import {
  mapPasswordResetRequestError,
  PASSWORD_RESET_EMAIL_SENT_MESSAGE,
} from "@/features/auth/utils/password-reset-messages";
import { isAssignableRole } from "../constants/user-roles";
import type { AdminUserDetail, AdminUserListItem } from "../types";

const NOT_CONFIGURED_MESSAGE =
  "Service role non configurata. Aggiungi SUPABASE_SERVICE_ROLE_KEY in .env.local.";

const SESSION_ERROR_MESSAGE = "Sessione non valida. Accedi di nuovo.";

type DbClient = SupabaseClient<Database>;

function mapListRow(
  row: {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
  },
  lastSignInAt: string | null,
  assignedCompaniesCount: number
): AdminUserListItem {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    lastSignInAt,
    createdAt: row.created_at,
    assignedCompaniesCount,
  };
}

/**
 * Esegue query sul database per operazioni admin: prova prima il client service
 * role (bypass RLS), poi ricade sul client autenticato se service_role non ha
 * GRANT sulle tabelle (42501 con hint service_role).
 */
async function withAdminDbClient<T>(
  operation: (client: DbClient) => Promise<{ data: T; error: PostgrestError | null }>
): Promise<{ data: T | null; dbError: PostgrestError | null; sessionError: string | null }> {
  if (isAdminClientConfigured()) {
    const admin = createAdminClient();
    const adminResult = await operation(admin);
    if (!adminResult.error || !isServiceRoleGrantError(adminResult.error)) {
      return {
        data: adminResult.data,
        dbError: adminResult.error,
        sessionError: null,
      };
    }
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, dbError: null, sessionError: SESSION_ERROR_MESSAGE };
  }

  const authResult = await operation(supabase);
  return {
    data: authResult.data,
    dbError: authResult.error,
    sessionError: null,
  };
}

function resolveDbFailure(
  dbError: PostgrestError | null,
  sessionError: string | null,
  fallback = "Operazione non riuscita."
): string | null {
  if (sessionError) {
    return sessionError;
  }
  if (dbError) {
    return describeDbError(dbError) ?? fallback;
  }
  return null;
}

async function fetchAuthLastSignInMap(): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();

  if (!isAdminClientConfigured()) {
    return map;
  }

  try {
    const admin = createAdminClient();
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data.users.length) {
        break;
      }

      for (const authUser of data.users) {
        map.set(authUser.id, authUser.last_sign_in_at ?? null);
      }

      if (data.users.length < perPage) {
        break;
      }
      page += 1;
    }
  } catch {
    // Ultimo accesso opzionale: non blocca la lista.
  }

  return map;
}

async function countCompaniesByUser(): Promise<Map<string, number>> {
  const { data, dbError, sessionError } = await withAdminDbClient(async (client) => {
    const result = await client
      .from("companies")
      .select("assigned_user_id")
      .not("assigned_user_id", "is", null);
    return { data: result.data, error: result.error };
  });

  const counts = new Map<string, number>();
  if (sessionError || dbError || !data) {
    return counts;
  }

  for (const row of data) {
    if (!row.assigned_user_id) continue;
    counts.set(row.assigned_user_id, (counts.get(row.assigned_user_id) ?? 0) + 1);
  }

  return counts;
}

export async function listAdminUsers(): Promise<{
  data: AdminUserListItem[];
  error: string | null;
}> {
  if (!isAdminClientConfigured()) {
    return { data: [], error: NOT_CONFIGURED_MESSAGE };
  }

  const { data: rows, dbError, sessionError } = await withAdminDbClient(async (client) => {
    const result = await client
      .from("users")
      .select("id,email,full_name,role,is_active,created_at")
      .order("created_at", { ascending: false });
    return { data: result.data, error: result.error };
  });

  const error = resolveDbFailure(dbError, sessionError, "Impossibile caricare gli utenti.");
  if (error) {
    return { data: [], error };
  }

  const [lastSignInMap, companyCounts] = await Promise.all([
    fetchAuthLastSignInMap(),
    countCompaniesByUser(),
  ]);

  return {
    data: (rows ?? []).map((row) =>
      mapListRow(row, lastSignInMap.get(row.id) ?? null, companyCounts.get(row.id) ?? 0)
    ),
    error: null,
  };
}

export async function getAdminUserById(id: string): Promise<{
  data: AdminUserDetail | null;
  error: string | null;
}> {
  if (!isAdminClientConfigured()) {
    return { data: null, error: NOT_CONFIGURED_MESSAGE };
  }

  const { data: row, dbError, sessionError } = await withAdminDbClient(async (client) => {
    const result = await client
      .from("users")
      .select("id,email,full_name,role,is_active,phone,created_at,updated_at")
      .eq("id", id)
      .maybeSingle();
    return { data: result.data, error: result.error };
  });

  const loadError = resolveDbFailure(dbError, sessionError);
  if (loadError) {
    return { data: null, error: loadError };
  }
  if (!row) {
    return { data: null, error: "Utente non trovato." };
  }

  const [lastSignInMap, companyCounts] = await Promise.all([
    fetchAuthLastSignInMap(),
    countCompaniesByUser(),
  ]);

  return {
    data: {
      ...mapListRow(row, lastSignInMap.get(row.id) ?? null, companyCounts.get(row.id) ?? 0),
      phone: row.phone,
      updatedAt: row.updated_at,
    },
    error: null,
  };
}

export async function listAssignableAgents(): Promise<{
  data: { id: string; label: string }[];
  error: string | null;
}> {
  if (!isAdminClientConfigured()) {
    return { data: [], error: NOT_CONFIGURED_MESSAGE };
  }

  const { data, dbError, sessionError } = await withAdminDbClient(async (client) => {
    const result = await client
      .from("users")
      .select("id,full_name,email,role,is_active")
      .eq("is_active", true)
      .in("role", ["agent", "manager", "org_admin", "super_admin"])
      .order("full_name", { ascending: true });
    return { data: result.data, error: result.error };
  });

  const error = resolveDbFailure(dbError, sessionError);
  if (error) {
    return { data: [], error };
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      label: row.full_name?.trim() || row.email,
    })),
    error: null,
  };
}

export interface AdminUserProfileInput {
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface CreateAdminUserInput extends AdminUserProfileInput {
  password: string;
}

export type InviteAdminUserInput = AdminUserProfileInput;

function buildInviteRedirectUrl(): string {
  const next = encodeURIComponent("/login/reset-password");
  return `${getAuthAppBaseUrl()}/auth/callback?next=${next}`;
}

async function syncAdminUserProfile(
  userId: string,
  input: AdminUserProfileInput,
  admin: ReturnType<typeof createAdminClient>,
  profileFailureFallback = "Creazione profilo non riuscita."
): Promise<{ error: string | null }> {
  const { dbError: profileError, sessionError: profileSessionError } = await withAdminDbClient(
    async (client) => {
      const result = await client.from("users").upsert(
        {
          id: userId,
          email: input.email,
          full_name: input.fullName,
          role: input.role,
          is_active: input.isActive,
        },
        { onConflict: "id" }
      );
      return { data: null, error: result.error };
    }
  );

  const profileFailure = resolveDbFailure(
    profileError,
    profileSessionError,
    profileFailureFallback
  );
  if (profileFailure) {
    await admin.auth.admin.deleteUser(userId);
    return { error: profileFailure };
  }

  if (!input.isActive) {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  }

  return { error: null };
}

export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<{ id: string | null; error: string | null; message?: string }> {
  if (!isAdminClientConfigured()) {
    return { id: null, error: NOT_CONFIGURED_MESSAGE };
  }

  if (!isAssignableRole(input.role)) {
    return { id: null, error: "Ruolo non valido." };
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (authError || !authData.user) {
    return {
      id: null,
      error: mapAuthAdminError(authError?.message ?? "Creazione utente non riuscita."),
    };
  }

  const userId = authData.user.id;
  const profileResult = await syncAdminUserProfile(userId, input, admin);
  if (profileResult.error) {
    return { id: null, error: profileResult.error };
  }

  return {
    id: userId,
    error: null,
    message: `Utente ${input.email} creato con successo. Può accedere con la password provvisoria impostata.`,
  };
}

export async function inviteAdminUser(
  input: InviteAdminUserInput
): Promise<{ id: string | null; error: string | null; message?: string }> {
  if (!isAdminClientConfigured()) {
    return { id: null, error: NOT_CONFIGURED_MESSAGE };
  }

  if (!isAssignableRole(input.role)) {
    return { id: null, error: "Ruolo non valido." };
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { full_name: input.fullName },
      redirectTo: buildInviteRedirectUrl(),
    }
  );

  if (authError || !authData.user) {
    return {
      id: null,
      error: mapAuthAdminError(authError?.message ?? "Invio invito non riuscito."),
    };
  }

  const userId = authData.user.id;
  const profileResult = await syncAdminUserProfile(userId, input, admin);
  if (profileResult.error) {
    return { id: null, error: profileResult.error };
  }

  return {
    id: userId,
    error: null,
    message: `Invito inviato a ${input.email}. L'utente potrà impostare la password al primo accesso.`,
  };
}

export interface UpdateAdminUserInput {
  fullName: string;
  role: UserRole;
  isActive: boolean;
  reassignCompaniesToUserId?: string | null;
}

export async function updateAdminUser(
  userId: string,
  input: UpdateAdminUserInput
): Promise<{ error: string | null; message?: string }> {
  if (!isAdminClientConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  if (!isAssignableRole(input.role) && input.role !== "manager" && input.role !== "super_admin") {
    return { error: "Ruolo non valido." };
  }

  const { data: existing, dbError: loadError, sessionError: loadSessionError } =
    await withAdminDbClient(async (client) => {
      const result = await client.from("users").select("role").eq("id", userId).maybeSingle();
      return { data: result.data, error: result.error };
    });

  const loadFailure = resolveDbFailure(loadError, loadSessionError);
  if (loadFailure) {
    return { error: loadFailure };
  }
  if (!existing) {
    return { error: "Utente non trovato." };
  }

  if (existing.role === "super_admin" && input.role !== "super_admin") {
    return { error: "Il ruolo super amministratore non può essere modificato da qui." };
  }

  const assignableRole = isAssignableRole(input.role) ? input.role : existing.role;

  const { dbError: updateError, sessionError: updateSessionError } = await withAdminDbClient(
    async (client) => {
      const result = await client
        .from("users")
        .update({
          full_name: input.fullName,
          role: assignableRole,
          is_active: input.isActive,
        })
        .eq("id", userId);
      return { data: null, error: result.error };
    }
  );

  const updateFailure = resolveDbFailure(updateError, updateSessionError, "Aggiornamento non riuscito.");
  if (updateFailure) {
    return { error: updateFailure };
  }

  if (input.reassignCompaniesToUserId) {
    const { dbError: reassignError, sessionError: reassignSessionError } = await withAdminDbClient(
      async (client) => {
        const result = await client
          .from("companies")
          .update({ assigned_user_id: input.reassignCompaniesToUserId! })
          .eq("assigned_user_id", userId);
        return { data: null, error: result.error };
      }
    );

    const reassignFailure = resolveDbFailure(
      reassignError,
      reassignSessionError,
      "Riassegnazione non riuscita."
    );
    if (reassignFailure) {
      return { error: reassignFailure };
    }
  }

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: input.fullName },
    ban_duration: input.isActive ? "none" : "876000h",
  });

  return { error: null, message: "Utente aggiornato." };
}

export async function deactivateAdminUser(
  userId: string
): Promise<{ error: string | null; message?: string }> {
  if (!isAdminClientConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE };
  }

  const { dbError: updateError, sessionError: updateSessionError } = await withAdminDbClient(
    async (client) => {
      const result = await client.from("users").update({ is_active: false }).eq("id", userId);
      return { data: null, error: result.error };
    }
  );

  const updateFailure = resolveDbFailure(updateError, updateSessionError, "Disattivazione non riuscita.");
  if (updateFailure) {
    return { error: updateFailure };
  }

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (banError) {
    return { error: mapAuthAdminError(banError.message) };
  }

  return {
    error: null,
    message: "Utente disattivato. Lo storico commerciale resta collegato; non potrà più accedere.",
  };
}

export async function sendAdminPasswordReset(
  email: string
): Promise<{ error: string | null; message?: string }> {
  const supabase = await createServerClient();
  const next = encodeURIComponent("/login/reset-password");
  const redirectTo = `${getAuthAppBaseUrl()}/auth/callback?next=${next}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: mapPasswordResetRequestError(error.message) };
  }

  return { error: null, message: PASSWORD_RESET_EMAIL_SENT_MESSAGE };
}

function mapAuthAdminError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("already been registered") || normalized.includes("already exists")) {
    return "Esiste già un account con questa email.";
  }

  if (normalized.includes("password") && normalized.includes("weak")) {
    return "La password non è sufficientemente sicura. Usa almeno 6 caratteri.";
  }

  if (normalized.includes("invalid") && normalized.includes("email")) {
    return "Indirizzo email non valido.";
  }

  return message;
}
