const ALLOWED_PATH_PREFIXES = [
  "/command-center",
  "/companies",
  "/contacts",
  "/activities",
  "/agenda",
  "/assistant",
  "/joy",
  "/visits",
  "/auto",
  "/maps",
  "/routes",
  "/voice",
  "/opportunities",
  "/products",
  "/reports",
  "/settings",
] as const;

const DEFAULT_POST_LOGIN_PATH = "/";

function isAllowedInternalPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }

  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Restituisce un percorso interno sicuro dopo il login.
 * Percorsi esterni, /login e route non riconosciute → dashboard.
 */
export function resolvePostLoginRedirect(
  candidate: string | null | undefined
): string {
  if (!candidate?.trim()) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  const trimmed = candidate.trim();

  if (trimmed.includes("://") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (!trimmed.startsWith("/")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  let pathname = trimmed;
  let search = "";

  try {
    const parsed = new URL(trimmed, "http://localhost");
    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (pathname === "/login" || pathname.startsWith("/login/") || pathname.startsWith("/api/")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (!isAllowedInternalPath(pathname)) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return `${pathname}${search}`;
}
