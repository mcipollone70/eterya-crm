import "server-only";

import type { User as AuthUser } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDbError } from "@/lib/supabase/errors";
import type { Database, Tables } from "@/lib/supabase/types";

function resolveFullName(authUser: AuthUser): string | null {
  const meta = authUser.user_metadata;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const candidate = meta.full_name ?? meta.name;
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapProfileRow(row: Tables<"users">) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
  };
}

/**
 * Garantisce che esista una riga in `public.users` per l'utente Supabase Auth.
 * Idempotente: inserisce al primo accesso, aggiorna email/nome se cambiano in Auth.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  authUser: AuthUser
): Promise<{ profile: Tables<"users"> | null; error: string | null }> {
  const email = authUser.email?.trim();
  if (!email) {
    return {
      profile: null,
      error: "Email mancante nel profilo di autenticazione.",
    };
  }

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (selectError) {
    return { profile: null, error: describeDbError(selectError) };
  }

  const fullName = resolveFullName(authUser);

  if (existing) {
    const emailChanged = existing.email !== email;
    const nameChanged = fullName !== null && existing.full_name !== fullName;

    if (!emailChanged && !nameChanged) {
      return { profile: existing, error: null };
    }

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        email,
        ...(fullName !== null ? { full_name: fullName } : {}),
      })
      .eq("id", authUser.id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return { profile: existing, error: describeDbError(updateError) };
    }

    return { profile: updated ?? existing, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      id: authUser.id,
      email,
      full_name: fullName,
    })
    .select("*")
    .maybeSingle();

  if (!insertError) {
    return { profile: inserted, error: null };
  }

  if (insertError.code === "23505") {
    const { data: raced, error: raceError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!raceError && raced) {
      return { profile: raced, error: null };
    }
  }

  return { profile: null, error: describeDbError(insertError) };
}

export { mapProfileRow };
