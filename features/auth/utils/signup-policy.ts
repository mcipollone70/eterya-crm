import "server-only";

function getInviteSecret(): string | null {
  const value = process.env.SIGNUP_INVITE_SECRET?.trim();
  return value || null;
}

export function isDevelopmentSignupAllowed(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Abilita la registrazione in produzione (solo lato server, senza pulsante pubblico). */
export function isAdminSignupEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

export function isInviteCodeValid(code: string | null | undefined): boolean {
  const secret = getInviteSecret();
  if (!secret || !code) {
    return false;
  }
  return code.trim() === secret;
}

/** Mostra il pulsante "Crea account" (development o link invito valido in produzione). */
export function canShowSignupButton(inviteCode?: string | null): boolean {
  if (isDevelopmentSignupAllowed()) {
    return true;
  }
  return isInviteCodeValid(inviteCode);
}

/** Consente l'elaborazione di una richiesta di registrazione. */
export function canProcessSignup(inviteCode?: string | null): boolean {
  if (isDevelopmentSignupAllowed()) {
    return true;
  }
  if (isAdminSignupEnabled()) {
    return true;
  }
  return isInviteCodeValid(inviteCode);
}

export const SIGNUP_DISABLED_MESSAGE =
  "La registrazione non è disponibile. Per ottenere un account contatta l'amministratore.";
