import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapAuthCallbackError } from "@/features/auth/utils/password-reset-messages";

function redirectToResetPassword(origin: string, error: string): NextResponse {
  const url = new URL("/login/reset-password", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function redirectToForgotPassword(origin: string, error: string): NextResponse {
  const url = new URL("/login/forgot-password", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function resolveSafeNextPath(next: string | null): string {
  if (next?.startsWith("/login/reset-password")) {
    return next;
  }
  return "/login/reset-password";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = resolveSafeNextPath(requestUrl.searchParams.get("next"));
  const authError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (authError) {
    return redirectToResetPassword(
      requestUrl.origin,
      mapAuthCallbackError(authError, errorDescription)
    );
  }

  if (!isSupabaseConfigured()) {
    return redirectToForgotPassword(
      requestUrl.origin,
      "Autenticazione non configurata. Contatta l'amministratore."
    );
  }

  if (!code && !(tokenHash && type)) {
    return redirectToForgotPassword(
      requestUrl.origin,
      "Link di recupero non valido. Richiedi un nuovo link."
    );
  }

  const supabase = await createServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToResetPassword(
        requestUrl.origin,
        "Il link di recupero è scaduto o non è valido. Richiedi un nuovo link."
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      return redirectToResetPassword(
        requestUrl.origin,
        "Il link di recupero è scaduto o non è valido. Richiedi un nuovo link."
      );
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
