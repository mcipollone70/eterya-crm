import "server-only";

import { cache } from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  ensureUserProfile,
  mapProfileRow,
} from "./services/user-provisioning.service";
import type { AppUserProfile } from "./types";

/**
 * Restituisce l'utente autenticato Supabase Auth, oppure `null`.
 * Sincronizza anche il profilo in `public.users` (idempotente).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    await ensureUserProfile(supabase, user);

    const { data: profile } = await supabase
      .from("users")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      return null;
    }

    return user;
  } catch {
    return null;
  }
});

/**
 * Profilo applicativo (`public.users`) dell'utente corrente.
 * Richiede sessione attiva; esegue il provisioning se mancante.
 */
export const getCurrentUserProfile = cache(async (): Promise<AppUserProfile | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { profile, error } = await ensureUserProfile(supabase, user);
    if (error || !profile) {
      return null;
    }

    return mapProfileRow(profile);
  } catch {
    return null;
  }
});
