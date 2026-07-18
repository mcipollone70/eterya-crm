import type { ManualChecklistGroup } from "../types";

export const MANUAL_CHECKLISTS: ManualChecklistGroup[] = [
  {
    id: "joy-os-revolution",
    title: "JOY Command Center — giornata unificata",
    items: [
      "Aprire /joy-ai e verificare Command Center: 4 azioni primarie + sezioni consiglio/priorità/tempo libero/strategia.",
      "Aprire Joy Drive (/joy-ai/drive) e verificare allineamento azioni + Agenda/Giro/Aziende/Altro.",
      "Eseguire «Inizia la giornata» e usare Segui / Organizza diversamente.",
      "Provare una card Ti consiglio (Esegui / Spiegami / Ignora) e memoria giorno Riprendi/Cancella.",
      "Registrare una visita a voce con conferma Copilot esplicita.",
      "Verificare nav mobile Joy centrale e Dashboard «Apri Joy» + sintesi.",
    ],
  },
  {
    id: "prima-visita",
    title: "Prima di uscire in visita",
    items: [
      "Controllare l'Agenda del giorno e gli appuntamenti confermati.",
      "Aprire la scheda azienda e verificare telefono, email e stato commerciale.",
      "Verificare che l'indirizzo sia completo e che l'azienda risulti geolocalizzata.",
      "Consultare note interne, follow-up e opportunità collegate all'azienda.",
      "Pianificare il percorso con Giro Visite o controllare la posizione sulla Mappa.",
      "Verificare connessione mobile e permessi GPS del browser se serve la navigazione.",
    ],
  },
  {
    id: "dopo-visita",
    title: "Dopo una visita",
    items: [
      "Registrare la visita dalla scheda azienda appena conclusa.",
      "Aggiornare lo stato commerciale se l'esito lo richiede.",
      "Inserire note sull'incontro per il passaggio di consegne al team.",
      "Creare un follow-up o un nuovo appuntamento in Agenda se necessario.",
      "Verificare che telefono, email e referente siano aggiornati.",
      "Segnalare eventuali opportunità commerciali collegate all'azienda.",
    ],
  },
  {
    id: "fine-giornata",
    title: "Fine giornata",
    items: [
      "Verificare che tutte le visite della giornata siano state registrate.",
      "Controllare appuntamenti e attività previste per il giorno successivo.",
      "Aggiornare priorità commerciali e stati delle aziende visitate.",
      "Effettuare il logout su dispositivi condivisi o non personali.",
    ],
  },
];

export const CHECKLIST_STORAGE_KEY = "eterya-manuale-checklists";
