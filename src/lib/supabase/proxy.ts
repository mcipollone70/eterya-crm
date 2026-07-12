import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { getSupabasePublicEnv } from "./env";

/** Route pubbliche raggiungibili senza sessione. */
const PUBLIC_ROUTES = ["/login"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Aggiorna la sessione Supabase sui cookie e protegge il gruppo (dashboard).
 * Se Supabase non è configurato degrada in modo trasparente lasciando passare
 * la richiesta, così l'app resta navigabile senza autenticazione.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
