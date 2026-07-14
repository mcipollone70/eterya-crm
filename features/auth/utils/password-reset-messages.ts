export function mapPasswordResetRequestError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Troppe richieste in poco tempo. Attendi qualche minuto e riprova.";
  }

  if (normalized.includes("invalid") && normalized.includes("email")) {
    return "Inserisci un indirizzo email valido.";
  }

  return "Invio email non riuscito. Riprova tra qualche istante.";
}

export function mapPasswordUpdateError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("session") ||
    normalized.includes("jwt") ||
    normalized.includes("expired") ||
    normalized.includes("invalid")
  ) {
    return "Il link di recupero è scaduto o non è valido. Richiedi un nuovo link.";
  }

  if (normalized.includes("password") && normalized.includes("weak")) {
    return "La password non è sufficientemente sicura. Scegline una più lunga.";
  }

  return "Aggiornamento password non riuscito. Riprova.";
}

export function mapAuthCallbackError(
  error: string | null,
  description: string | null
): string {
  const combined = `${error ?? ""} ${description ?? ""}`.toLowerCase();

  if (combined.includes("expired") || combined.includes("invalid")) {
    return "Il link di recupero è scaduto o non è valido. Richiedi un nuovo link.";
  }

  return "Autenticazione non riuscita. Richiedi un nuovo link di recupero.";
}

export const PASSWORD_RESET_EMAIL_SENT_MESSAGE =
  "Se l'email è registrata, riceverai a breve un messaggio con le istruzioni per reimpostare la password.";

export const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Password aggiornata. Accedi con la nuova password.";

export const PASSWORD_RESET_SESSION_MISSING_MESSAGE =
  "Il link di recupero non è valido o è scaduto. Richiedi un nuovo link.";
