/** Errori OAuth/scope/token che richiedono ricollegamento, non un generico "sync con errori". */
export function isGoogleCalendarAuthOrScopeError(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }
  return (
    /ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(message) ||
    /insufficient (authentication )?scopes?/i.test(message) ||
    /insufficient permission/i.test(message) ||
    /invalid_grant/i.test(message) ||
    /token.*(scadut|expir|revok|invalid|mancante)/i.test(message) ||
    /refresh token/i.test(message) ||
    /ricollega google calendar/i.test(message) ||
    /permessi google calendar insufficienti/i.test(message) ||
    /manca lo scope calendar\.events/i.test(message)
  );
}

/** Errori transienti (rete / 5xx) → badge «errore temporaneo». */
export function isGoogleCalendarTemporaryError(message: string | null | undefined): boolean {
  if (!message || isGoogleCalendarAuthOrScopeError(message)) {
    return false;
  }
  return (
    /non ha risposto correttamente/i.test(message) ||
    /riprova tra poco/i.test(message) ||
    /temporane/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(message) ||
    /\b5\d{2}\b/.test(message)
  );
}

/** Messaggio utente chiaro al posto di payload JSON grezzi di Google. */
export function toUserFacingGoogleSyncError(message: string | null | undefined): string | null {
  if (!message) {
    return null;
  }

  if (isGoogleCalendarAuthOrScopeError(message)) {
    return "Permessi Google Calendar insufficienti. Ricollega l'account dalle Impostazioni.";
  }

  if (/\{[\s\S]*"error"[\s\S]*\}/.test(message) || /"status"\s*:\s*"PERMISSION_DENIED"/i.test(message)) {
    return "Sincronizzazione Google Calendar non riuscita. Riprova o ricollega l'account dalle Impostazioni.";
  }

  return message;
}
