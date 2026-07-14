import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePostLoginRedirect } from "@/features/auth/utils/post-login-redirect";
import type { Database } from "./types";
import { getSupabasePublicEnv } from "./env";

/** Route pubbliche raggiungibili senza sessione. */
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

/** Route pubbliche accessibili anche con sessione attiva (es. recupero password). */
const PUBLIC_ROUTES_ALLOWING_AUTHENTICATED = ["/login/reset-password", "/auth/callback"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function allowsAuthenticatedPublicAccess(pathname: string): boolean {
  return PUBLIC_ROUTES_ALLOWING_AUTHENTICATED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isDevelopmentBypass(): boolean {
  return process.env.NODE_ENV === "development";
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  const returnPath = `${pathname}${request.nextUrl.search}`;
  redirectUrl.searchParams.set("redirectedFrom", returnPath);
  return NextResponse.redirect(redirectUrl);
}

function redirectAfterLogin(request: NextRequest, redirectedFrom: string | null): NextResponse {
  const destination = resolvePostLoginRedirect(redirectedFrom);
  const parsed = new URL(destination, request.url);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = parsed.pathname;
  redirectUrl.search = parsed.search;
  redirectUrl.hash = "";
  return NextResponse.redirect(redirectUrl);
}

/**
 * Aggiorna la sessione Supabase sui cookie e protegge il gruppo (dashboard).
 * Se Supabase non è configurato: in produzione blocca ogni route non pubblica
 * (fail-closed); in development consente il bypass per sviluppo locale.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const env = getSupabasePublicEnv();

  if (!env) {
    if (isDevelopmentBypass()) {
      return NextResponse.next({ request });
    }

    if (isPublicRoute(pathname)) {
      return NextResponse.next({ request });
    }

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Autenticazione non configurata." },
        { status: 503 }
      );
    }

    return redirectToLogin(request, pathname);
  }

  let response = NextResponse.next({ request });

  const supabase = createSsrServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANTE: non inserire logica tra creazione client e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(pathname)) {
    return redirectToLogin(request, pathname);
  }

  if (user && isPublicRoute(pathname)) {
    if (allowsAuthenticatedPublicAccess(pathname)) {
      return response;
    }
    return redirectAfterLogin(request, request.nextUrl.searchParams.get("redirectedFrom"));
  }

  return response;
}
