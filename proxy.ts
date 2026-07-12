import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (ex middleware) di Next.js 16 — runtime Node.js.
 * Rinnova la sessione Supabase e protegge le route autenticate.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Applica a ogni richiesta tranne:
     * - _next/static (file statici)
     * - _next/image (ottimizzazione immagini)
     * - favicon.ico e file immagine
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
