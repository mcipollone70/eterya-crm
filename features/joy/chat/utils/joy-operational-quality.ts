/**
 * Quality gate: forbid helpdesk-style CRM page redirects when Joy already has data.
 * Keep free of server-only so unit checks can import it.
 */

const HELPDESK_REDIRECT_RE =
  /(?:^|\n)\s*(?:apri\s+(?:la\s+)?(?:pagina|elenco|mappa|agenda|pipeline|calendario|follow-up)|vai\s+(?:su|nelle|in)|consulta\s+(?:la\s+)?(?:dashboard|pagina)|filtra\s+(?:le\s+)?aziende|scegli\s+manualmente)/i;

export function joyResponseHasHelpdeskRedirect(content: string): boolean {
  return HELPDESK_REDIRECT_RE.test(content);
}

/** Append propose→confirm close when data already drove a solution. */
export function withJoyConfirmationAsk(content: string): string {
  if (
    /vuoi che|di['']\s*«?conferma|nessun salvataggio automatico|conferma sempre/i.test(
      content
    )
  ) {
    return content;
  }
  return `${content.trim()}\n\n**Proposta pronta.** Vuoi che proceda? Di' «sì» / «conferma» per preparare le azioni (nessun salvataggio automatico), oppure dimmi cosa cambiare.`;
}
