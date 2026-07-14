import "server-only";

const APP_URL_ENV = "NEXT_PUBLIC_APP_URL";

/** URL base dell'app per redirect OAuth e recupero password. */
export function getAuthAppBaseUrl(): string {
  const fromEnv = process.env[APP_URL_ENV]?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
