import type { ManualChangelogEntry } from "../types";

/**
 * Cronologia aggiornamenti del manuale.
 * Aggiungere nuove voci in cima all'array per versioni future.
 */
export const MANUAL_CHANGELOG: ManualChangelogEntry[] = [
  {
    version: "1.18",
    date: "17 luglio 2026",
    title: "Release GOLD unica — fluidità voce Joy",
    highlights: [
      "Voce: una risposta breve = un solo MP3 continuo; stati preparing/ready/speaking; niente fallback a metà OpenAI.",
      "spokenText vs displayText centralizzati; A/B coral/nova/shimmer nel pannello Test voce su /joy-ai; winner coral in joy-voice-profile.",
      "Ripeti da cache client; AbortController su richieste TTS supersedute; instructions commerciali italiane coerenti.",
    ],
  },
  {
    version: "1.17",
    date: "17 luglio 2026",
    title: "Release GOLD — chiusura Joy OS",
    highlights: [
      "Guide «Prima giornata con Joy»; sezioni Command Center mai vuote senza aiuto; route legacy /joy* → /joy-ai.",
      "Voce: stop mic prima del TTS sul Command Center; salvataggi Joy verificati su ID database.",
      "Nav: Centro Operativo CRM distinto da JOY Command Center; script typecheck ufficiale.",
    ],
  },
  {
    version: "1.16",
    date: "17 luglio 2026",
    title: "JOY Command Center — unificazione OS",
    highlights: [
      "Joy OS orchestratore attivo: chat, suggerimenti e Dashboard passano da joy-runtime / getJoyCommandCenterSnapshot.",
      "/joy-ai diventa JOY Command Center (AI Sales Operating System) con azioni primarie, sezioni Ti consiglio / Priorità / Tempo libero / Prossima azione / Strategia e memoria giorno.",
      "Nav mobile: Joy centrale · Giro · Agenda · Aziende · Altro; Dashboard con Apri Joy + sintesi (niente duplicato Command Center).",
    ],
  },
  {
    version: "1.15",
    date: "16 luglio 2026",
    title: "JOY OS — Project Revolution",
    highlights: [
      "Joy come centro operativo: Drive con Parla / Organizza giornata / Registra visita / Prossima azione + Agenda/Giro/Aziende/Altro.",
      "Motori OS approfonditi: decisioni trasparenti, contraddizione «Non te lo consiglio», radar max 5, piano «vendere di più oggi», simulazioni sola lettura, memoria operativa giorno (localStorage).",
      "Collaudo Revolution in JOY_OS_REVOLUTION_COLLAUDO.md; CRM resta motore dati, mutazioni solo con conferma.",
    ],
  },
  {
    version: "1.14",
    date: "16 luglio 2026",
    title: "Joy AI Sales OS — Master Release",
    highlights: [
      "Radar «due ore libere», obiettivi fatturato («Voglio fatturare X»), preparazione chiamata/visita/email con conferma Copilot.",
      "Scoping agente su ricerca aziende, coach e proposte; radar GPS; voce «conferma»/«annulla» su Joy Drive; Fine giornata secondaria; offline banner.",
      "Briefing rapido su «prossima tappa»; preferenze suggerimenti auto in localStorage; Manuale/FAQ aggiornati.",
    ],
  },
  {
    version: "1.13",
    date: "16 luglio 2026",
    title: "Joy Commercial Copilot — Release 3",
    highlights: [
      "Proposte proattive unificate (chiamate, prospect, visite vicine, follow-up, opportunità ferme, preventivi, ordini, campioni, ticket) e Coach commerciale.",
      "Memoria estesa (contatto/ID, ordine, follow-up, goal, azione proposta); debrief con checkbox + voice edit e salvataggio esito su visits; probabilità opportunità persistita.",
      "Briefing azienda senza rumore vuoto; mid-route fabbri/showroom/falegnami ed evita traffico (ri-ottimizzazione OSRM, no API live); auto mattina/fine giornata su Joy Drive + campo testo se mic assente.",
    ],
  },
  {
    version: "1.12",
    date: "16 luglio 2026",
    title: "Joy Drive — chiusura Release 2",
    highlights: [
      "Zona completa: CAP, comune, provincia, GPS/coordinate e raggio km persistente su rigenera/modifica.",
      "Mid-tour: sostituisci X con Y, rimuovi, prospect vicino per GPS, max 6 visite (salvo limite intake >6); home a 4 pulsanti grandi.",
      "Mic attivo anche in conferma proposta per comandi vocali; Manuale/FAQ allineati.",
    ],
  },
  {
    version: "1.11",
    date: "16 luglio 2026",
    title: "Joy Drive — Organizza il mio giro (FASE 2)",
    highlights: [
      "Intake multi-turn: giorno, zona CAP/città/GPS (raggio), Prospect/Clienti/Entrambi, n. visite, orario fine, partenza (GPS / sede / ultima posizione).",
      "Planner su Agenda+visite, opportunità, coordinate e tempi strada OSRM — Conferma apre Giro Visite con le tappe; Rigenera / Modifica / Annulla, mai auto-salva.",
      "Comandi voce: salta, aggiungi (force-include), prospect vicino, entro le 17, prossima tappa, chiama referente (contatti), apri Google Maps.",
    ],
  },
  {
    version: "1.10",
    date: "16 luglio 2026",
    title: "Joy Drive — assistente vocale mobile",
    highlights: [
      "Nuova route /joy-ai/drive: home con quattro azioni grandi per uso smartphone.",
      "Conversazione continua, tour planner, cerca azienda e fine giornata su dati CRM reali («Cosa fare oggi» a voce).",
      "Sintesi vocale breve (Web Speech API) e dettagli a schermo; conferma Copilot obbligatoria.",
      "Ingresso da Joy AI e Centro Operativo «Parla con Joy»; sezione Manuale Joy Drive.",
    ],
  },
  {
    version: "1.9",
    date: "16 luglio 2026",
    title: "Google Calendar bidirezionale",
    highlights: [
      "OAuth Calendar con refresh token, stato firmato e verifica scope calendar.events.",
      "Sync CRM→Google (visite, follow-up, promemoria) e Google→Agenda come «Evento Google» (senza auto-conversione).",
      "Badge: sincronizzato / non configurato / da riconnettere / in corso / errore temporaneo; CRM operativo indipendente.",
      "Impostazioni: Collega / Ricollega / Sincronizza ora / Scollega.",
    ],
  },
  {
    version: "1.8",
    date: "16 luglio 2026",
    title: "Centro Operativo in Dashboard",
    highlights: [
      "Home Dashboard: intestazione «Centro Operativo» con badge CRM/Calendar, meteo e «Inizia la giornata» che apre Joy AI con riepilogo dati reali.",
      "Quattro scorciatoie grandi: Organizza giro (tour planner Joy), Agenda, Follow-up, Parla con Joy.",
      "Joy: saluto mattutino strutturato; giro visite sempre con Conferma / Modifica / Annulla (nessun auto-salvataggio).",
      "Badge Calendar aggiornati: sincronizzato / non collegato.",
    ],
  },
  {
    version: "1.7",
    date: "16 luglio 2026",
    title: "Joy AI — Assistente commerciale conversazionale",
    highlights: [
      "Modalità Conversazione con stati In ascolto / Sto pensando / Ti propongo / Conferma / Completata.",
      "Memoria contestuale (azienda, comune, CAP, destinazione) e briefing automatico da scheda azienda.",
      "Giro visite intelligente con filtri e conferma; debriefing «Joy registra»; modalità Guida con voce browser.",
      "Suggerimenti mattutini e proposte commerciali; nessuna mutazione senza conferma Copilot.",
    ],
  },
  {
    version: "1.6",
    date: "16 luglio 2026",
    title: "Completamento commerciale e Joy AI",
    highlights: [
      "Preventivo: stato Accettato/Inviato dal form modifica aggiorna correttamente pipeline e conversione in ordine.",
      "Dettagli preventivo, ordine, campione e assistenza: link Cronologia verso la tab Attività della scheda azienda.",
      "Rimozione interessi/prodotti collegati all'azienda dalla tab Prodotti.",
      "Report avanzato: conteggio ordini solo su record con stato evasione (niente doppio conteggio preventivi accettati).",
      "Joy AI: timeline con visite e opportunità, scoping agente, conferma Copilot con stato failed, azioni touch-friendly su mobile.",
    ],
  },
  {
    version: "1.5",
    date: "15 luglio 2026",
    title: "Dashboard intelligente",
    highlights: [
      "La home / è ora una Dashboard a widget: saluto, attività di oggi, prospect, clienti da richiamare, statistiche, mappa veloce, Joy AI, ultime attività, azioni rapide e meteo.",
      "Mission Control spostato su /mission-control, accessibile dal menu laterale.",
      "Widget Joy AI con link diretti (?q=) e meteo Open-Meteo con geolocalizzazione.",
      "Manuale aggiornato con guida alla Dashboard intelligente.",
    ],
  },
  {
    version: "1.4",
    date: "15 luglio 2026",
    title: "Joy AI — upgrade assistente commerciale",
    highlights: [
      "Chat stile ChatGPT con avatar Joy/Tu, timestamp e indicatore «Joy AI sta scrivendo...».",
      "Sidebar conversazioni: nuova chat, cronologia per data, rinomina ed elimina singola conversazione.",
      "Layer strumenti CRM (features/joy/tools): aziende, agenda, visite, giro visite, statistiche.",
      "Suggerimenti dinamici basati sul portafoglio; persistenza conversazioni su joy_conversations (RLS).",
      "Manuale Joy AI aggiornato con guida completa e messaggio dati insufficienti.",
    ],
  },
  {
    version: "1.3",
    date: "15 luglio 2026",
    title: "Joy AI — assistente commerciale integrato",
    highlights: [
      "Nuova pagina /joy-ai con chat stile assistente, streaming risposte e memoria conversazioni locale.",
      "Interrogazione CRM reale: prospect per città, clienti inattivi, agenda, priorità, email mancanti, statistiche.",
      "Azioni rapide: clienti vicini (GPS), prospect, agenda oggi/domani, statistiche, giro visite.",
      "Pulsanti Nuova chat, Cancella chat, Copia risposta, Rigenera risposta.",
    ],
  },
  {
    version: "1.2",
    date: "15 luglio 2026",
    title: "Giro Visite v1 stabile",
    highlights: [
      "Nuova route canonica /giro-visite con form di pianificazione completo.",
      "Raggio corridoio configurabile (1–20 km), filtri azienda e integrazione agenda.",
      "Ottimizzazione ordine tappe nearest-neighbor, riepilogo tempi e salvataggio su visit_tours.",
      "Mappa con legenda, popup azienda, stati giro (Bozza → Completato) e link Google Maps.",
    ],
  },
  {
    version: "1.1",
    date: "15 luglio 2026",
    title: "Manuale operativo ampliato",
    highlights: [
      "Checklist operative interattive con persistenza locale.",
      "Sezione Domande frequenti con 12 risposte operative.",
      "Tour guidato del CRM al primo accesso.",
      "Sezione Manuale Amministratore per ruoli org_admin e super_admin.",
      "Ricerca interna con evidenziazione sezioni e miglioramenti grafici.",
    ],
  },
  {
    version: "1.0",
    date: "15 luglio 2026",
    title: "Prima release del manuale",
    highlights: [
      "15 sezioni operative su login, aziende, import Excel, geocoding, mappa, agenda e giro visite.",
      "Indice navigabile con ricerca per argomento.",
      "Contenuti allineati alle funzioni certificate della Release 1.0 del CRM.",
    ],
  },
];
