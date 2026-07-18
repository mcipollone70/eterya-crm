/** Lunghezza minima query prima di avviare la ricerca server-side. */
export const COMPANY_SEARCH_MIN_LENGTH = 2;

/** Numero minimo di risultati per ricerca (requisito prodotto). */
export const COMPANY_SEARCH_RESULT_LIMIT = 30;

/** Campi testuali su cui cercare le aziende. */
export const COMPANY_SEARCH_TEXT_FIELDS = [
  "name",
  "city",
  "vat_number",
  "phone",
  "email",
  "contact_email",
  "contact_phone",
  "mobile",
] as const;
