/** Numero massimo di aziende per pagina nelle query bounded. */
export const VISIT_TOUR_FETCH_PAGE_SIZE = 500;

/** Limite totale per singola area geografica (evita timeout su zone dense). */
export const VISIT_TOUR_MAX_FETCH_PER_BOUNDS = 1500;

/** Raggio iniziale attorno alla posizione utente (km). */
export const VISIT_TOUR_INITIAL_RADIUS_KM = 60;

/** Padding extra sui bounds mappa per precaricare l'area adiacente. */
export const VISIT_TOUR_BOUNDS_PADDING_RATIO = 0.12;

/** Risultati massimi per ricerca nome. */
export const VISIT_TOUR_SEARCH_LIMIT = 30;

/** Debounce ricaricamento al pan/zoom mappa (ms). */
export const VISIT_TOUR_BOUNDS_DEBOUNCE_MS = 400;

/** Buffer predefinito attorno a un percorso (km). */
export const VISIT_TOUR_ROUTE_BUFFER_KM = 4;
