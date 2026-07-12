/**
 * Accesso centralizzato alle variabili d'ambiente pubbliche di Supabase.
 * Evita duplicazione tra client browser, client server e proxy, e permette
 * il degrado controllato quando la configurazione non è presente.
 */
export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/** `true` se URL e anon key pubbliche sono configurate. */
export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();

  if (!env) {
    throw new Error(
      "Supabase non configurato. Imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  return env;
}
