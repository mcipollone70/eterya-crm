import type { ManualFaqItem } from "../types";

export const MANUAL_FAQ: ManualFaqItem[] = [
  {
    id: "faq-accesso",
    question: "Come accedo al CRM?",
    answer:
      "Apri l'indirizzo del CRM nel browser. Se non sei autenticato verrai reindirizzato a /login. Inserisci email e password fornite dall'Amministratore e clicca Accedi. Per recuperare la password usa il link Password dimenticata?.",
  },
  {
    id: "faq-ricerca-azienda",
    question: "Come trovo rapidamente un'azienda?",
    answer:
      "Usa l'icona lente nell'header per la ricerca globale su aziende, contatti, opportunità e visite. In alternativa vai su Aziende (/companies) e applica filtri per stato commerciale, priorità o ultima visita.",
  },
  {
    id: "faq-scheda-azienda",
    question: "Come apro la scheda di un'azienda?",
    answer:
      "Dall'elenco Aziende clicca sulla ragione sociale, oppure seleziona un risultato dalla ricerca globale. Nella scheda trovi anagrafica, contatti, visite, opportunità e azioni come Modifica e Registra visita.",
  },
  {
    id: "faq-import-excel",
    question: "Come importo un elenco Excel?",
    answer:
      "Dal menu seleziona Importa Aziende (/companies/import) o usa il pulsante nella pagina Aziende. Segui il wizard: caricamento file, mapping colonne, pulizia dati, geocoding e anteprima prima dell'import definitivo.",
  },
  {
    id: "faq-mappa-vuota",
    question: "Perché un'azienda non compare sulla mappa?",
    answer:
      "Solo le aziende geocodificate con coordinate valide appaiono su Mappa (/maps). Verifica che l'indirizzo sia completo, esegui il geocoding dalla pagina Aziende e controlla che i filtri provincia/comune non la escludano.",
  },
  {
    id: "faq-registra-visita",
    question: "Come registro una visita sul campo?",
    answer:
      "Apri la scheda azienda e usa Registra visita. Compila data, esito e note dell'incontro. La visita comparirà nello storico dell'azienda e potrà essere collegata ad attività o opportunità.",
  },
  {
    id: "faq-agenda",
    question: "Come creo un appuntamento in Agenda?",
    answer:
      "Vai su Agenda (/agenda), scegli la vista Giorno, Settimana o Mese e clicca su una data o su Nuovo appuntamento. Inserisci titolo, orario, azienda collegata (opzionale) e note, poi salva.",
  },
  {
    id: "faq-filtri",
    question: "Come filtro le aziende per provincia o stato commerciale?",
    answer:
      "Nella pagina Aziende usa i filtri in alto per stato commerciale, priorità e ultima visita. Per provincia e comune usa i filtri nella pagina Mappa (/maps). Puoi combinare più filtri contemporaneamente.",
  },
  {
    id: "faq-giro-visite",
    question: "Come funziona il Giro Visite?",
    answer:
      "Da Giro Visite (/giro-visite) imposta partenza, destinazione e raggio corridoio, aggiungi aziende lungo il percorso e usa Ottimizza ordine tappe. Puoi salvare il giro, gestire gli stati (Bozza, Pianificato, In corso, Completato) e aprirlo in Google Maps.",
  },
  {
    id: "faq-admin",
    question: "Chi può accedere al modulo Amministrazione?",
    answer:
      "Solo gli account con ruolo org_admin o super_admin vedono la voce Amministrazione nel menu. Gli altri ruoli (Agente, Manager, Sola lettura) non hanno accesso alla gestione utenti.",
  },
  {
    id: "faq-google-calendar",
    question: "Come collego Google Calendar?",
    answer:
      "Vai in Impostazioni (/settings) e clicca «Collega Google Calendar» (o «Ricollega» se il badge indica riconnessione). Autorizza l'accesso al calendario Google. Dopo il collegamento: visite/follow-up/promemoria vanno verso Google; gli eventi creati in Google compaiono in Agenda come «Evento Google» senza conversione automatica. Usa «Sincronizza ora» per aggiornare. Il CRM resta utilizzabile anche senza Calendar.",
  },
  {
    id: "faq-joy-ai",
    question: "Cos'è JOY Command Center?",
    answer:
      "JOY Command Center (/joy-ai) è l'AI Sales Operating System: orchestra decision, radar, coach, sell-more-today, free-time e simulazioni tramite joy-os. Azioni primarie Parla / Inizia giornata / Organizza giro / Registra visita; sezioni Ti consiglio / Priorità / Tempo libero / Prossima azione / Strategia. Ogni mutazione richiede conferma Copilot — nessun salvataggio automatico.",
  },
  {
    id: "faq-joy-drive",
    question: "Cos'è Joy Drive e come si usa?",
    answer:
      "Joy Drive (/joy-ai/drive) è la superficie vocale del Command Center: stessi motori OS, microfono, TTS breve e conferma «conferma»/«annulla». Home: Parla con Joy, Inizia la giornata, Registra una visita, Organizza il giro + Agenda/Giro/Aziende/Altro.",
  },
  {
    id: "faq-errori-comuni",
    question: "Cosa fare se la sessione scade o compare «Database non configurato»?",
    answer:
      "Per sessione scaduta effettua nuovamente il login. Per «Database non configurato» l'Amministratore deve verificare NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavviare l'applicazione.",
  },
];
