import type { ManualSection } from "../types";

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "introduzione",
    title: "Introduzione",
    purpose:
      "Presenta Eterya CRM, il sistema di gestione commerciale per agenti, utenti e amministratori che lavorano sul territorio. Il manuale descrive le funzioni attualmente disponibili e le procedure operative consigliate.",
    showMedia: true,
    steps: [
      "Accedi al CRM con le credenziali fornite dall'Amministratore.",
      "Usa il menu laterale per spostarti tra Dashboard, Aziende, Agenda, Mappa e le altre sezioni.",
      "Consulta questo manuale in qualsiasi momento dal menu Manuale.",
      "Per ricerche rapide su aziende, contatti e visite usa la barra di ricerca nell'header (icona lente).",
    ],
    tips: [
      "Il CRM è ottimizzato per desktop e mobile: su smartphone il menu si apre dall'icona in alto a sinistra.",
      "Mantieni aggiornati i dati delle aziende per sfruttare al meglio mappa, filtri e priorità commerciali.",
      "Usa la terminologia del sistema: Agente (operatore commerciale), Utente (account generico), Amministratore (gestione utenti e accessi).",
    ],
    errors: [
      {
        problem: "Non trovo una funzione descritta nel manuale.",
        solution:
          "Verifica di avere l'ultima versione del CRM. Le funzioni non ancora rilasciate sono indicate con il box «Funzione prevista in un prossimo aggiornamento.»",
      },
    ],
  },
  {
    id: "accesso-al-crm",
    title: "Accesso al CRM",
    purpose:
      "Permette ad Agente, Utente e Amministratore di autenticarsi in modo sicuro e accedere all'area protetta del CRM.",
    steps: [
      "Apri l'indirizzo del CRM nel browser.",
      "Se non sei autenticato, verrai reindirizzato alla pagina Accedi (/login).",
      "Inserisci l'indirizzo email e la password fornite dall'Amministratore.",
      "Clicca Accedi per entrare nel sistema.",
      "In caso di password dimenticata, usa il link Password dimenticata? per avviare il recupero via email.",
      "Dopo l'accesso, verrai portato alla Dashboard o alla pagina richiesta prima del login.",
      "Per uscire, usa il pulsante Esci nell'header in alto a destra.",
    ],
    tips: [
      "Non condividere le credenziali con altri operatori: ogni Agente deve usare il proprio account.",
      "Se il login non funziona, verifica di non avere attivato il blocco maiuscole (Caps Lock).",
      "Su dispositivi condivisi, effettua sempre il logout al termine della sessione.",
    ],
    errors: [
      {
        problem: "Messaggio «Autenticazione non configurata».",
        solution:
          "L'Amministratore deve configurare le variabili Supabase in .env.local e riavviare il server di sviluppo o il deploy.",
      },
      {
        problem: "Credenziali non valide.",
        solution:
          "Controlla email e password. Se il problema persiste, chiedi all'Amministratore di verificare che l'account sia attivo e di reimpostare la password.",
      },
      {
        problem: "Pagina bianca dopo il login.",
        solution:
          "Aggiorna la pagina, svuota la cache del browser o prova una finestra in incognito. Se persiste, segnala all'Amministratore.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard — Centro Operativo",
    purpose:
      "Apre la giornata con il Centro Operativo: badge CRM/Calendar, meteo, avvio giornata con Joy AI e scorciatoie operative (giro, agenda, follow-up, Joy).",
    steps: [
      "Dal menu laterale seleziona Dashboard (oppure vai alla home /).",
      "In alto trovi il Centro Operativo con badge «CRM operativo» e stato Calendar (sincronizzato o non collegato).",
      "Consulta il meteo e premi «Inizia la giornata»: si apre Joy AI con un riepilogo reale (visite, follow-up scaduti, preventivi da seguire, prospect vicini) e la domanda se organizzare il giro.",
      "Usa i quattro pulsanti grandi: Organizza giro (Joy tour planner), Agenda, Follow-up, Parla con Joy (apre Joy Drive /joy-ai/drive).",
      "Sotto restano i widget: attività di oggi, prospect, clienti da richiamare, KPI commerciali, statistiche, mappa veloce e Joy AI.",
      "Per la vista Mission Control classica, apri Mission Control dal menu (/mission-control).",
      "Se il database è vuoto, la Dashboard propone l'importazione Excel come primo passo.",
    ],
    tips: [
      "Inizia sempre dalla Dashboard: «Inizia la giornata» apre Joy con dati CRM reali, non una pagina statica.",
      "Organizza giro supporta vincoli (CAP, città, prospect/clienti, max visite, orario, partenza/arrivo); Joy propone e chiede Conferma / Modifica / Annulla — nessun salvataggio automatico.",
      "Il widget meteo usa la tua posizione (se consentita) tramite Open-Meteo, senza API key.",
      "Su mobile i widget si adattano automaticamente: scorri verticalmente per vedere tutti i blocchi.",
    ],
    errors: [
      {
        problem: "Dashboard vuota o «Database non configurato».",
        solution:
          "Verifica la configurazione Supabase. L'Amministratore deve impostare NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      {
        problem: "Meteo non disponibile.",
        solution:
          "Consenti la geolocalizzazione nel browser oppure riprova più tardi. In assenza di rete il widget mostra un fallback.",
      },
      {
        problem: "Dati non aggiornati.",
        solution:
          "Ricarica la pagina. I dati vengono letti dal database al caricamento; dopo modifiche importanti usa Aggiorna nel browser.",
      },
    ],
  },
  {
    id: "gestione-aziende",
    title: "Gestione aziende",
    purpose:
      "Consente di visualizzare, creare e gestire l'anagrafica delle aziende cliente e prospect, con dati commerciali, contatti e stato di geolocalizzazione.",
    showMedia: true,
    steps: [
      "Dal menu seleziona Aziende (/companies).",
      "Consulta l'elenco tabellare con ragione sociale, comune, provincia, P.IVA, telefono, email, stato commerciale, priorità e ultima visita.",
      "Clicca sul nome di un'azienda per aprire la scheda dettaglio.",
      "Per creare una nuova azienda manualmente, clicca Nuova azienda.",
      "Per importare un elenco da file, clicca Importa Aziende.",
      "Usa la paginazione in fondo alla tabella per navigare tra le pagine e cambiare il numero di righe visibili.",
    ],
    tips: [
      "Compila sempre almeno ragione sociale, indirizzo e comune: servono per geocoding e mappa.",
      "L'icona geo verde indica che l'azienda è geolocalizzata e visibile sulla mappa.",
      "Aggiorna lo stato commerciale dalla scheda azienda per mantenere filtri e report coerenti.",
    ],
    errors: [
      {
        problem: "Impossibile caricare le aziende.",
        solution:
          "Verifica la connessione di rete e la configurazione Supabase. Controlla i log lato server se il messaggio persiste.",
      },
      {
        problem: "Azienda non trovata dopo la creazione.",
        solution:
          "Controlla eventuali filtri attivi nella pagina elenco e reimposta i filtri su Tutti.",
      },
    ],
  },
  {
    id: "ricerca-e-filtri",
    title: "Ricerca e filtri",
    purpose:
      "Permette di restringere l'elenco aziende e trovare rapidamente record specifici tramite filtri commerciali, geografici e di priorità, oltre alla ricerca globale.",
    steps: [
      "Nella pagina Aziende, usa i filtri in alto: stato commerciale, priorità, ultima visita, famiglia prodotto, livello interesse e prodotto acquistato.",
      "Attiva l'ordinamento per priorità o ultima visita con i rispettivi toggle.",
      "Combina più filtri: l'elenco mostra solo le aziende che soddisfano tutti i criteri selezionati.",
      "Per la ricerca globale, clicca l'icona lente nell'header e digita nome azienda, contatto, opportunità o visita.",
      "Seleziona un risultato dalla palette comandi per aprire direttamente la scheda corrispondente.",
      "Per rimuovere un filtro, reimposta il selettore su Tutti o deseleziona l'ordinamento attivo.",
    ],
    tips: [
      "Salva combinazioni di filtri utili annotando i parametri URL se devi condividere una vista con un collega.",
      "Il filtro ultima visita aiuta a individuare clienti non visitati da tempo.",
      "La ricerca globale è più veloce dello scorrimento manuale dell'elenco quando conosci già il nome.",
    ],
    errors: [
      {
        problem: "Nessun risultato con filtri attivi.",
        solution:
          "Reimposta i filtri uno alla volta per capire quale criterio esclude i record. Verifica che esistano aziende con quei attributi.",
      },
      {
        problem: "La ricerca globale non trova un'azienda.",
        solution:
          "Controlla l'ortografia. Se l'azienda è appena stata importata, attendi il completamento dell'import e ricarica la pagina.",
      },
    ],
  },
  {
    id: "scheda-azienda",
    title: "Scheda azienda",
    purpose:
      "Raccoglie in un'unica vista tutte le informazioni di un'azienda: anagrafica, indirizzo, contatti (telefono, email, PEC), visite, attività, opportunità e prodotti collegati.",
    steps: [
      "Dall'elenco Aziende clicca sulla ragione sociale desiderata.",
      "Nella sezione Anagrafica consulta P.IVA, codice fiscale, categoria e settore.",
      "Nella sezione Indirizzo verifica comune, provincia, CAP e regione.",
      "Nella sezione Contatti azienda trovi telefono, cellulare, email, PEC, sito web e referente.",
      "Modifica lo stato commerciale dal selettore in alto nella scheda.",
      "Usa Modifica per aggiorare i dati anagrafici, oppure Registra visita per annotare un incontro sul campo.",
      "Consulta le sezioni Storico contatti, Follow-up, Opportunità e Prodotti per l'attività commerciale collegata.",
      "Su mobile usa la barra azioni rapide per dettatura vocale, agenda e giro visite.",
    ],
    tips: [
      "Telefono ed email mostrati in elenco provengono dai campi azienda; verifica che siano aggiornati prima di chiamate o invii.",
      "Le note interne sono visibili solo nel CRM e utili per passaggi di consegne tra Agenti.",
      "Dalla scheda puoi aprire Google Maps se l'azienda è geolocalizzata.",
    ],
    errors: [
      {
        problem: "Campi telefono o email vuoti.",
        solution:
          "Completa i dati con Modifica oppure reimporta l'elenco Excel con mapping corretto delle colonne.",
      },
      {
        problem: "Impossibile eliminare l'azienda.",
        solution:
          "L'eliminazione rimuove anche i contatti collegati. Verifica di avere i permessi necessari; in caso di errore contatta l'Amministratore.",
      },
    ],
  },
  {
    id: "scheda-azienda-premium",
    title: "Scheda Azienda Premium",
    purpose:
      "Trasforma la scheda azienda nel centro operativo del CRM con riepilogo commerciale, azioni rapide e nove tab: Panoramica, Attività, Visite, Commerciale, Prodotti, Documenti, Mappa, Note e Statistiche.",
    steps: [
      "Apri una azienda dall'elenco (/companies) per accedere alla scheda premium.",
      "In alto consulta i badge Cliente/Prospect e la priorità commerciale (Alta, Media, Bassa).",
      "Usa le azioni rapide: telefonata, visita, appuntamento, nota, Cronologia, tab Commerciale, Nuovo preventivo, Nuovo ordine, Giro Visite, Joy AI.",
      "Tab Panoramica: anagrafica completa, referenti e pulsanti Chiama, Invia email, Apri Google Maps, Apri sito web.",
      "Tab Attività: cronologia con filtri Oggi, Settimana, Mese, Sempre (raggiungibile anche dal pulsante Cronologia e dai dettagli preventivo/ordine/campione/ticket).",
      "Tab Visite: storico visite con data, ora, durata, esito, prodotti trattati, probabilità vendita e prossima azione.",
      "Tab Commerciale: opportunità, follow-up, preventivi, ordini, campioni e assistenza con link al dettaglio e azioni rapide (nuovo preventivo/ordine/campione/ticket).",
      "Tab Prodotti: interessi e acquisti collegabili al catalogo; puoi rimuovere un prodotto dall'azienda con il pulsante cestino.",
      "Tab Documenti: allegati PDF, Word, Excel e immagini collegati all'azienda.",
      "Tab Mappa: posizione geolocalizzata con pulsante Apri navigatore.",
      "Tab Note: editor note e note interne con ultimo aggiornamento.",
      "Tab Statistiche: visite, telefonate, email, preventivi (linkati), ordini e valore totale ordini.",
      "Da Apri Joy AI la conversazione eredita automaticamente l'ID azienda selezionata.",
    ],
    tips: [
      "Joy AI aperto dalla scheda mostra il contesto azienda e risponde con azioni collegate alla stessa azienda.",
      "Se la mappa è vuota, correggi l'indirizzo e attendi il geocoding.",
      "Lo storico dettagliato delle revisioni note sarà disponibile quando attivato nel database.",
    ],
    errors: [
      {
        problem: "Tab Documenti vuota.",
        solution:
          "Non ci sono ancora allegati collegati a questa azienda. L'area è predisposta per PDF, Word, Excel e immagini.",
      },
      {
        problem: "Joy AI non riconosce l'azienda.",
        solution:
          "Apri Joy AI dal pulsante nella scheda azienda (non dal menu generico) per passare automaticamente l'ID azienda.",
      },
    ],
  },
  {
    id: "importazione-excel",
    title: "Importazione Excel",
    purpose:
      "Importa elenchi aziende da file Excel (.xlsx) tramite un wizard guidato: analisi colonne, mapping campi, pulizia dati, geocoding e anteprima prima dell'inserimento nel database.",
    showMedia: true,
    steps: [
      "Dal menu seleziona Importa Aziende (/companies/import) oppure usa il pulsante nella pagina Aziende.",
      "Passo 1 — Seleziona il file Excel: trascina o clicca per caricare.",
      "Passo 2 — Mapping: associa ogni colonna del file ai campi CRM (ragione sociale, indirizzo, P.IVA, telefono, email, ecc.).",
      "Passo 3 — Pulizia: rivedi il report di normalizzazione e i record corretti automaticamente.",
      "Passo 4 — Geocoding: avvia la geolocalizzazione delle righe con indirizzo valido.",
      "Passo 5 — Anteprima: controlla statistiche e un campione dei record prima dell'import definitivo.",
      "Passo 6 — Import: conferma per scrivere i dati nel database.",
      "Al termine, vai su Aziende per verificare l'elenco importato.",
    ],
    tips: [
      "Prepara il file Excel con intestazioni chiare nella prima riga.",
      "Mappa sempre almeno ragione sociale e indirizzo per abilitare geocoding e mappa.",
      "Esegui un import di prova con poche righe prima di caricare elenchi molto grandi.",
    ],
    errors: [
      {
        problem: "File non riconosciuto o errore di analisi.",
        solution:
          "Usa formato .xlsx. Verifica che il foglio contenga dati e che non sia protetto da password.",
      },
      {
        problem: "Colonne mappate in modo errato.",
        solution:
          "Torna al passo Mapping e correggi le associazioni prima di procedere con l'import.",
      },
      {
        problem: "Import completato ma aziende senza coordinate.",
        solution:
          "Completa il geocoding dalla pagina Aziende (pannello Geolocalizzazione) o dalla revisione geocoding.",
      },
    ],
  },
  {
    id: "geolocalizzazione",
    title: "Geolocalizzazione",
    purpose:
      "Converte gli indirizzi delle aziende in coordinate geografiche (latitudine/longitudine) per visualizzarle sulla mappa, pianificare giri visite e calcolare distanze.",
    steps: [
      "Dalla pagina Aziende consulta il pannello Geolocalizzazione con i conteggi: senza coordinate, geocodificate, da revisionare, fallite.",
      "Clicca Geocodifica aziende senza coordinate per avviare il processo batch.",
      "Attendi il messaggio di completamento e ricarica se necessario.",
      "Per i casi ambigui o errati, vai su Revisione geocoding (/companies/geocoding/review).",
      "Nella revisione, approva, correggi o scarta le proposte una per una.",
      "Durante l'import Excel, il geocoding può essere eseguito già al passo 4 del wizard.",
    ],
    tips: [
      "Indirizzi completi (via, civico, CAP, comune, provincia) aumentano la precisione del geocoding.",
      "Il servizio Geoapify deve essere configurato dall'Amministratore per abilitare il geocoding automatico.",
      "Rivedi periodicamente i record «da revisionare» per evitare marker fuori posizione sulla mappa.",
    ],
    errors: [
      {
        problem: "Geocoding non disponibile o badge «non configurato».",
        solution:
          "L'Amministratore deve impostare la chiave API Geoapify nelle variabili d'ambiente del server.",
      },
      {
        problem: "Azienda geocodificata in posizione errata.",
        solution:
          "Correggi l'indirizzo nella scheda azienda, poi usa Revisione geocoding o rilancia il geocoding batch.",
      },
      {
        problem: "Geocoding fallito per molte righe.",
        solution:
          "Verifica qualità degli indirizzi nell'Excel. Comuni abbreviati o CAP mancanti causano errori frequenti.",
      },
    ],
  },
  {
    id: "mappa-aziende",
    title: "Mappa aziende",
    purpose:
      "Visualizza su mappa interattiva le aziende geolocalizzate, con filtri per stato commerciale, provincia e comune, per esplorare il territorio e pianificare visite.",
    showMedia: true,
    steps: [
      "Dal menu seleziona Mappa (/maps).",
      "Usa i Filtri mappa nella barra laterale: stato commerciale, provincia e comune.",
      "Seleziona una provincia per caricare l'elenco dei comuni disponibili.",
      "Consulta il contatore aziende visibili aggiornato in base ai filtri.",
      "Clicca sui marker per aprire il popup con i dati dell'azienda e il link alla scheda.",
      "Usa Vai alla mia posizione per centrare la mappa sulla posizione GPS del dispositivo (richiede permesso browser).",
      "Zoom e pan con mouse o gesture touch per esplorare l'area.",
    ],
    tips: [
      "Combina filtro provincia + stato commerciale per trovare lead in una zona specifica.",
      "Su mobile ruota il dispositivo in orizzontale per una vista mappa più ampia.",
      "Solo le aziende geocodificate compaiono sulla mappa: completa prima il geocoding.",
    ],
    errors: [
      {
        problem: "Mappa vuota.",
        solution:
          "Verifica che esistano aziende geocodificate. Controlla i filtri provincia/comune e reimposta su Tutti.",
      },
      {
        problem: "Impossibile caricare la mappa.",
        solution:
          "Ricarica la pagina. Se compare un errore di database, verifica la configurazione Supabase.",
      },
      {
        problem: "Posizione GPS non disponibile.",
        solution:
          "Abilita i permessi di geolocalizzazione nel browser e verifica che il dispositivo abbia il GPS attivo.",
      },
    ],
  },
  {
    id: "calendario-condiviso",
    title: "Calendario condiviso",
    purpose:
      "Offre una vista di squadra degli appuntamenti (visite, follow-up e promemoria) di tutti gli agenti su base settimanale, con legenda colori per agente e filtri per agente e tipologia.",
    steps: [
      "Dal menu seleziona Calendario condiviso (/calendario).",
      "Consulta gli appuntamenti della settimana raggruppati per giorno.",
      "Usa la legenda colori in alto per distinguere gli agenti.",
      "Filtra per agente specifico, tipologia (visite, follow-up, promemoria) o cambia settimana con il selettore data.",
      "Clicca un appuntamento per aprire la scheda azienda o la visita collegata.",
    ],
    tips: [
      "Il calendario condiviso è di sola lettura: per creare o modificare eventi usa l'Agenda personale.",
      "Ogni agente ha un colore assegnato automaticamente, utile per il coordinamento di squadra.",
      "Filtra per un singolo agente per verificarne rapidamente il carico settimanale.",
    ],
    errors: [
      {
        problem: "Calendario vuoto.",
        solution:
          "Non ci sono appuntamenti aperti nella settimana selezionata. Cambia settimana o rimuovi i filtri.",
      },
    ],
  },
  {
    id: "notifiche-intelligenti",
    title: "Notifiche intelligenti",
    purpose:
      "Aggrega in un unico centro gli avvisi operativi generati automaticamente dai moduli: follow-up in ritardo, opportunità ferme, preventivi in attesa, campioni da rientrare e ticket di assistenza urgenti.",
    steps: [
      "Dal menu seleziona Notifiche (/notifiche).",
      "Consulta gli avvisi ordinati per gravità (Urgente, Media, Bassa).",
      "Ogni notifica mostra categoria, descrizione e gravità.",
      "Clicca una notifica per aprire l'elemento collegato (azienda, opportunità, preventivo, campione o ticket).",
    ],
    tips: [
      "Le notifiche sono calcolate in tempo reale: si aggiornano man mano che gestisci le attività.",
      "Le opportunità ferme da oltre 21 giorni e i preventivi in attesa da oltre 14 giorni generano avvisi automatici.",
      "I campioni con rientro previsto superato e i ticket ad alta priorità aperti compaiono come avvisi.",
      "Joy AI risponde a richieste sullo stato operativo dei singoli moduli.",
    ],
    errors: [
      {
        problem: "Nessuna notifica.",
        solution:
          "Significa che non ci sono criticità aperte: follow-up, opportunità, preventivi, campioni e assistenza sono in regola.",
      },
    ],
  },
  {
    id: "agenda-e-appuntamenti",
    title: "Agenda e appuntamenti",
    purpose:
      "Offre un calendario operativo unificato per visite, follow-up e promemoria, con viste giorno/settimana/mese e filtri per Agente, tipo e stato.",
    steps: [
      "Dal menu seleziona Agenda (/agenda).",
      "Scegli la vista Giorno, Settimana o Mese con le tab in alto.",
      "Usa i filtri per Agente, tipo evento e stato per restringere il calendario.",
      "Clicca su una data o su Nuovo appuntamento per creare un evento.",
      "Compila titolo, data, ora, azienda collegata (opzionale) e note.",
      "Salva per aggiungere l'appuntamento al calendario.",
      "Clicca su un evento esistente per visualizzarne i dettagli o modificarlo.",
      "In Impostazioni è possibile collegare Google Calendar per la sincronizzazione bidirezionale.",
    ],
    tips: [
      "Crea appuntamenti con azienda collegata per trovarli rapidamente dalla scheda azienda.",
      "La vista settimana è ideale per pianificare il giro visite settimanale.",
      "Gli eventi creati in Google compaiono in Agenda come «Evento Google» (senza conversione automatica in visita/follow-up).",
      "Controlla il badge Calendar (sincronizzato / da riconnettere / errore temporaneo) e usa «Sincronizza ora» se serve.",
    ],
    errors: [
      {
        problem: "Agenda vuota.",
        solution:
          "Verifica i filtri Agente e data. Crea un nuovo appuntamento o registra una visita dalla scheda azienda.",
      },
      {
        problem: "Badge «Calendar da riconnettere» o errori di permesso.",
        solution:
          "Vai in Impostazioni → Ricollega Google Calendar e concedi di nuovo l'accesso al calendario (scope calendar.events). Poi premi «Sincronizza ora».",
      },
      {
        problem: "Sincronizzazione Google Calendar non funziona.",
        solution:
          "Verifica che l'Amministratore abbia configurato OAuth. Ricollega l'account, controlla l'ultimo errore nel pannello Impostazioni e riprova «Sincronizza ora».",
      },
    ],
  },
  {
    id: "giro-visite",
    title: "Giro visite",
    purpose:
      "Pianifica percorsi commerciali sul campo: imposta partenza e arrivo, trova aziende geolocalizzate lungo il tragitto, seleziona le tappe, ottimizza l'ordine e salva il giro per riutilizzarlo.",
    steps: [
      "Dal menu seleziona Giro Visite (/giro-visite).",
      "Nella tab Pianifica imposta data, orari, raggio corridoio e filtri (stato commerciale, provincia, comune).",
      "Scegli partenza: posizione attuale, azienda o indirizzo manuale (senza obbligo GPS).",
      "Scegli destinazione: azienda, indirizzo o appuntamento agenda del giorno.",
      "Clicca Calcola percorso: il sistema usa OSRM e mostra le aziende entro il raggio scelto.",
      "Aggiungi tappe dalla lista candidati; usa Ottimizza ordine tappe per l'ordine suggerito.",
      "Consulta mappa, legenda e riepilogo (km, tempi, durata visite).",
      "Salva il giro nella tab Giri salvati oppure apri Google Maps per la navigazione.",
      "Per giri multi-tappa avanzati passa alla modalità Ottimizza giro.",
    ],
    tips: [
      "Le aziende senza coordinate non compaiono: verifica geocoding in Aziende o Mappa.",
      "Seleziona un appuntamento agenda solo se l'azienda collegata è geolocalizzata.",
      "Con molte tappe Google Maps potrebbe troncare i waypoint: il CRM mostra un avviso.",
      "Usa i filtri commerciali per concentrarti su prospect e clienti da ricontattare.",
    ],
    errors: [
      {
        problem: "Nessuna azienda candidata lungo il percorso.",
        solution:
          "Amplia il raggio corridoio, allarga i filtri o verifica che le aziende nella zona abbiano lat/lng.",
      },
      {
        problem: "Azienda non geolocalizzata.",
        solution:
          "Apri la scheda azienda, correggi l'indirizzo e attendi il geocoding prima di usarla come tappa o destinazione agenda.",
      },
      {
        problem: "Calcolo percorso non riuscito.",
        solution:
          "Verifica partenza e destinazione. OSRM pubblico può essere temporaneamente non disponibile: riprova tra qualche minuto.",
      },
      {
        problem: "Geolocalizzazione non supportata.",
        solution:
          "Usa un indirizzo manuale o seleziona un'azienda come partenza invece della posizione GPS.",
      },
    ],
  },
  {
    id: "follow-up-attivita",
    title: "Follow-up e attività",
    purpose:
      "Gestisce i richiami commerciali programmati e lo storico attività dell'Agente: scadenze, priorità, completamento e collegamento alla scheda azienda.",
    steps: [
      "Dal menu apri Attività (/activities) e seleziona la sezione Follow-up.",
      "Crea un follow-up dalla lista o dal tab Commerciale della scheda azienda.",
      "Filtra per stato, priorità, periodo e azienda; usa la vista calendario se disponibile.",
      "Completa o riprogramma i richiami in ritardo; gli avvisi compaiono anche nelle Notifiche.",
      "Chiedi a Joy AI «Follow-up scaduti» o «Follow-up» per un riepilogo operativo.",
    ],
    tips: [
      "Collega sempre il follow-up all'azienda corretta per mantenerlo nel tab Commerciale.",
      "I follow-up scaduti alimentano priorità e avvisi della giornata.",
    ],
    errors: [
      {
        problem: "Elenco follow-up vuoto o errore tabella.",
        solution:
          "Verifica di aver applicato la migrazione 20260713_follow_ups.sql e di non avere filtri troppo restrittivi.",
      },
    ],
  },
  {
    id: "pipeline-commerciale",
    title: "Pipeline Commerciale",
    purpose:
      "Visualizza e gestisce le opportunità commerciali in una vista Kanban per fase: dalla lead alla chiusura (vinta o persa). Permette di trascinare le card tra le colonne, filtrare per agente, azienda, priorità e data di chiusura prevista.",
    steps: [
      "Dal menu laterale seleziona Pipeline Commerciale (/opportunities).",
      "Consulta le colonne per fase: Nuova, Contatto avviato, Sopralluogo, Preventivo inviato, Trattativa, Vinta, Persa.",
      "Ogni colonna mostra il numero di opportunità e il valore totale stimato.",
      "Trascina una card tra le colonne per aggiornare la fase, oppure usa il menu «Sposta fase» sulla singola card.",
      "Clicca sul titolo dell'opportunità per aprire il dettaglio; clicca sul nome azienda per la scheda cliente.",
      "Usa i filtri in alto: Agente, Azienda, Priorità (probabilità), intervallo date di chiusura prevista.",
      "Per creare una nuova opportunità apri la scheda azienda e usa la sezione Opportunità.",
      "Da mobile scorri orizzontalmente le colonne Kanban; il dropdown «Sposta fase» è l'alternativa al drag-and-drop.",
    ],
    tips: [
      "La probabilità percentuale sulla card indica la priorità commerciale: verde ≥70%, giallo 40–69%, rosso <40%.",
      "Il riepilogo in alto mostra il valore totale delle opportunità aperte e la distribuzione per fase.",
      "Joy AI risponde a richieste come «mostrami la pipeline» o «opportunità sopra 15.000 euro».",
      "Le modifiche di fase vengono registrate nello storico dell'opportunità e nella cronologia contatti dell'azienda.",
    ],
    errors: [
      {
        problem: "Nessuna opportunità visibile con filtri attivi.",
        solution:
          "Reimposta i filtri con «Reimposta filtri» oppure verifica che esistano opportunità con i criteri selezionati.",
      },
      {
        problem: "Impossibile trascinare su mobile.",
        solution:
          "Usa il menu a tendina «Sposta fase» presente su ogni card per cambiare la fase manualmente.",
      },
      {
        problem: "Colonne vuote dopo migrazione database.",
        solution:
          "Verifica che la migrazione opportunity_pipeline sia stata applicata su Supabase. Le opportunità legacy vengono mappate automaticamente alle fasi corrispondenti.",
      },
    ],
  },
  {
    id: "report-commerciali",
    title: "Report Commerciali",
    purpose:
      "Presenta l'imbuto di vendita (opportunità aperte → preventivi inviati → preventivi accettati → ordini) con tassi di conversione tra le fasi e una sintesi dei moduli commerciali (pipeline, ordini, campioni, assistenza).",
    steps: [
      "Dal menu seleziona Report Commerciali (/report-commerciale).",
      "Consulta l'imbuto di vendita con conteggi, valori e percentuali di conversione tra le fasi.",
      "Usa «Esporta CSV» per scaricare imbuto e KPI in un file compatibile con Excel.",
      "Analizza le tessere di sintesi: valore pipeline, tasso conversione, valore ordini, preventivi accettati, campioni, assistenza.",
      "Clicca una tessera per aprire il modulo corrispondente e approfondire.",
      "Per grafici geografici e per stato commerciale, apri la Dashboard avanzata dal pulsante in alto.",
    ],
    tips: [
      "L'imbuto aiuta a individuare la fase con maggiore dispersione dei lead.",
      "I dati sono calcolati in tempo reale dai moduli Pipeline, Preventivi e Ordini.",
      "Usa i report a inizio settimana per pianificare le priorità commerciali.",
    ],
    errors: [
      {
        problem: "Valori a zero.",
        solution:
          "Verifica che esistano opportunità, preventivi e ordini. I report si popolano man mano che i moduli vengono usati.",
      },
    ],
  },
  {
    id: "statistiche-avanzate",
    title: "Statistiche avanzate",
    purpose:
      "Mostra i trend degli ultimi 6 mesi (valore ordini, opportunità vinte e perse per mese), la dimensione media delle trattative e il tasso di successo complessivo.",
    steps: [
      "Dal menu seleziona Statistiche (/statistiche).",
      "Consulta gli indicatori: tasso di successo, dimensione media trattativa, totale ordini vinti.",
      "Analizza il grafico «Valore ordini per mese» per l'andamento del fatturato.",
      "Confronta i grafici «Opportunità vinte» e «Opportunità perse» per mese.",
    ],
    tips: [
      "Il tasso di successo è calcolato su opportunità chiuse (vinte su vinte + perse).",
      "La dimensione media trattativa considera solo gli ordini vinti.",
      "I trend coprono gli ultimi 6 mesi in base alle date di chiusura.",
    ],
    errors: [
      {
        problem: "Grafici vuoti.",
        solution:
          "Servono opportunità chiuse (vinte/perse) con date valide. Chiudi le opportunità in pipeline per popolare i trend.",
      },
    ],
  },
  {
    id: "gestione-documenti",
    title: "Gestione Documenti",
    purpose:
      "Archivia e gestisce i documenti collegati alle aziende (e alle altre entità): PDF, Word, Excel e immagini, con caricamento sicuro su Supabase Storage e download tramite link firmati temporanei.",
    steps: [
      "Dal menu seleziona Documenti (/documenti) per l'archivio centrale.",
      "Filtra per tipo di collegamento (Azienda, Opportunità, Prodotto) o cerca per nome file.",
      "Per caricare un documento apri la scheda azienda e vai al tab Documenti, quindi usa Carica.",
      "Scarica un documento con l'icona di download: viene generato un link firmato valido temporaneamente.",
      "Elimina un documento con l'icona cestino (rimuove file e riferimento).",
    ],
    tips: [
      "Formati ammessi: PDF, Word (.doc/.docx), Excel (.xls/.xlsx) e immagini (JPG, PNG, WebP, GIF).",
      "Dimensione massima per file: 15 MB.",
      "I file sono archiviati in un bucket privato: l'accesso avviene solo tramite link firmati generati lato server.",
      "Joy AI risponde a richieste come «mostrami i documenti» o «ultimi allegati».",
    ],
    errors: [
      {
        problem: "Messaggio «Bucket Storage non configurato».",
        solution:
          "L'Amministratore deve eseguire la migrazione 20260715_documents_storage.sql su Supabase (crea il bucket privato «documents» e le policy).",
      },
      {
        problem: "Formato non supportato.",
        solution:
          "Converti il file in PDF, Word, Excel o immagine. Altri formati non sono ammessi.",
      },
      {
        problem: "Download non disponibile.",
        solution:
          "Il link firmato scade dopo 60 secondi: riprova generandone uno nuovo con l'icona di download.",
      },
    ],
  },
  {
    id: "gestione-assistenza",
    title: "Gestione Assistenza",
    purpose:
      "Gestisce i ticket di assistenza post-vendita e gli interventi collegati ad aziende e prodotti: apertura, priorità, stato di lavorazione, programmazione intervento e risoluzione.",
    steps: [
      "Dal menu seleziona Assistenza (/assistenza).",
      "Consulta l'elenco ticket con numero, azienda, categoria, priorità, stato e data apertura.",
      "Usa i filtri: stato, priorità, agente, azienda.",
      "Clicca Nuovo ticket per aprire un intervento: seleziona azienda, prodotto, categoria (guasto, manutenzione, reclamo, ecc.), priorità e descrizione.",
      "Apri un ticket per il dettaglio con link a scheda azienda e prodotto.",
      "In modifica aggiorna lo stato (Aperto, In lavorazione, In attesa, Risolto, Chiuso): le date di risoluzione e chiusura vengono registrate automaticamente.",
      "Compila il campo Risoluzione alla chiusura per documentare l'intervento.",
    ],
    tips: [
      "Ogni ticket aperto genera una voce nello storico contatti dell'azienda.",
      "Usa la priorità Alta per gli interventi urgenti da gestire per primi.",
      "Programma l'intervento con la data dedicata per organizzare le uscite tecniche.",
      "Joy AI risponde a richieste come «mostrami i ticket di assistenza» o «interventi aperti».",
    ],
    errors: [
      {
        problem: "Messaggio «Tabella assistenza non trovata».",
        solution:
          "L'Amministratore deve eseguire la migrazione 20260715_service_tickets.sql su Supabase.",
      },
      {
        problem: "Elenco ticket vuoto.",
        solution:
          "Apri un ticket con Nuovo ticket oppure reimposta i filtri attivi.",
      },
    ],
  },
  {
    id: "gestione-campioni",
    title: "Gestione Campioni",
    purpose:
      "Traccia i campioni fisici di prodotto consegnati alle aziende e prospect: quale campione, a chi, quando, con rientro previsto e stato (Consegnato, Restituito, Acquistato, Perso).",
    steps: [
      "Dal menu seleziona Campioni (/campioni).",
      "Consulta l'elenco con descrizione campione, azienda, prodotto, quantità, stato e data consegna.",
      "Usa i filtri: stato, agente, azienda, intervallo date di consegna.",
      "Clicca Nuovo campione per registrare una consegna: seleziona azienda, prodotto dal catalogo, quantità, data e rientro previsto.",
      "Apri un campione per vedere il dettaglio con link alla scheda azienda e al prodotto.",
      "In modifica aggiorna lo stato (es. da Consegnato a Restituito o Acquistato): la data di rientro viene registrata automaticamente per i restituiti.",
      "Elimina un campione dal dettaglio se registrato per errore.",
    ],
    tips: [
      "Ogni campione registrato genera una voce nello storico contatti dell'azienda.",
      "Usa il rientro previsto per sollecitare la restituzione dei campioni in prestito.",
      "Lo stato Acquistato evidenzia i campioni che hanno portato a una vendita.",
      "Joy AI risponde a richieste come «mostrami i campioni» o «campioni in prestito».",
    ],
    errors: [
      {
        problem: "Messaggio «Tabella campioni non trovata».",
        solution:
          "L'Amministratore deve eseguire la migrazione 20260715_product_samples.sql su Supabase.",
      },
      {
        problem: "Elenco campioni vuoto.",
        solution:
          "Registra un campione con Nuovo campione oppure reimposta i filtri attivi.",
      },
    ],
  },
  {
    id: "catalogo-prodotti",
    title: "Catalogo Prodotti",
    purpose:
      "Gestisce il catalogo prodotti Eterya organizzato per famiglie (Zanzariere, Tapparelle, VEPA, Tende Cristal, Tende tecniche a rullo) con fascia prezzo, stato attivo e collegamento alle opportunità e agli interessi azienda.",
    steps: [
      "Dal menu seleziona Catalogo Prodotti (/products).",
      "Consulta i prodotti raggruppati per famiglia con fascia prezzo e stato attivo/non attivo.",
      "Usa i filtri: ricerca per nome, famiglia prodotto, stato attivo.",
      "Clicca su un prodotto per aprire la scheda dettaglio.",
      "Usa Nuovo prodotto per aggiungere voci al catalogo.",
      "In modifica aggiorna nome, famiglia, descrizione, fascia prezzo, note e stato attivo.",
      "Dalla scheda prodotto consulta le aziende collegate (interesse / acquistato).",
      "Dalla scheda azienda (tab Prodotti) collega interessi o acquisti ai prodotti del catalogo; usa il cestino per rimuovere un collegamento.",
    ],
    tips: [
      "I prodotti attivi sono selezionabili in opportunità, preventivi e ordini.",
      "La fascia prezzo è indicativa: usa note per varianti o listini specifici.",
      "Joy AI risponde a richieste sul catalogo, ad esempio «mostrami i prodotti VEPA».",
    ],
    errors: [
      {
        problem: "Prodotto non visibile in opportunità.",
        solution:
          "Verifica che il prodotto sia Attivo e appartenga alla stessa famiglia selezionata nel form opportunità.",
      },
      {
        problem: "Catalogo vuoto.",
        solution:
          "Aggiungi prodotti con Nuovo prodotto oppure chiedi all'Amministratore di popolare il catalogo.",
      },
    ],
  },
  {
    id: "ordini",
    title: "Ordini",
    purpose:
      "Gestisce gli ordini commerciali: creazione da preventivo o manuale, numerazione, azienda, referente, righe prodotto, totali, stati di evasione (Bozza → Consegnato), date ordine/consegna, note, collegamento a opportunità/preventivo e ticket assistenza.",
    steps: [
      "Dal menu seleziona Ordini (/ordini) oppure Nuovo ordine (/ordini/new).",
      "Converti un preventivo accettato con «Converti in ordine», oppure crea un ordine manuale.",
      "Aggiorna lo stato evasione: Bozza, Confermato, In lavorazione, Pronto, Consegnato, Annullato (anche con azioni rapide nel dettaglio).",
      "Dal dettaglio apri scheda azienda, pipeline, preventivo di origine (se presente), stampa/PDF o crea un ticket assistenza collegato.",
      "Usa Stampa / PDF per la vista stampabile dell'ordine (Salva come PDF dal browser).",
      "Nel tab Commerciale della scheda azienda vedi gli ordini dell'azienda.",
    ],
    tips: [
      "Gli ordini corrispondono alle opportunità in fase Vinta (stage won) con order_status di evasione.",
      "Lo stesso prodotto può essere inserito su più righe con configurazioni e prezzi differenti.",
      "Esegui la migrazione commerciale 20260716 per stati evasione e righe dettaglio.",
      "Joy AI risponde a richieste su ordini aperti e valori.",
    ],
    errors: [
      {
        problem: "Elenco ordini vuoto.",
        solution:
          "Converti un preventivo o crea un ordine da /ordini/new. Verifica i filtri attivi.",
      },
    ],
  },
  {
    id: "preventivi",
    title: "Preventivi",
    purpose:
      "Gestisce i preventivi commerciali: numerazione progressiva, azienda, referente, opportunità/pipeline, date, validità, righe prodotto (quantità, prezzo, sconto, IVA, totale), stati, note, stampa/PDF, duplica, email preparata (mailto/copia) e conversione in ordine. I preventivi condividono la tabella opportunità e si sincronizzano con la pipeline.",
    steps: [
      "Dal menu seleziona Preventivi (/preventivi) oppure Nuovo preventivo (/preventivi/new).",
      "Dalla scheda azienda apri il tab Commerciale per creare/vedere preventivi, ordini, opportunità e follow-up.",
      "Compila titolo, famiglia prodotto, validità e righe prodotto; il numero (PRV-AAAA-NNNN) si genera automaticamente se lasciato vuoto.",
      "Salva in Bozza, poi usa «Segna come inviato» oppure Prepara email (mailto) / Copia bozza.",
      "Dal dettaglio usa i cambi stato rapidi: Accettato, Rifiutato, Scaduto. Anche dalla modifica, Accettato/Inviato aggiornano pipeline (Accettato converte in ordine).",
      "Usa Stampa / PDF per la vista stampabile (Salva come PDF dal browser).",
      "Duplica un preventivo o convertilo in ordine quando accettato.",
      "Dal dettaglio apri Cronologia per la tab Attività della scheda azienda.",
      "Consulta lo storico modifiche essenziale nel dettaglio.",
    ],
    tips: [
      "Stati: Bozza, Inviato, Accettato, Rifiutato, Scaduto, Annullato.",
      "La conversione in ordine imposta la fase pipeline a Vinta e lo stato evasione ordine a Confermato.",
      "Lo stesso prodotto può essere inserito su più righe con configurazioni e prezzi differenti.",
      "Esegui la migrazione 20260716_commercial_quotes_orders_lines.sql per righe, numerazione e storico.",
      "Joy AI risponde a domande sui preventivi e offre il link dalla pagina Preventivi.",
    ],
    errors: [
      {
        problem: "Elenco preventivi vuoto.",
        solution:
          "Crea un preventivo da /preventivi/new o dal tab Commerciale della scheda azienda. Reimposta i filtri se attivi.",
      },
      {
        problem: "Impossibile segnare come inviato.",
        solution:
          "Solo i preventivi in stato Bozza possono essere marcati come inviati. Modifica lo stato se necessario.",
      },
    ],
  },
  {
    id: "consigli-operativi",
    title: "Consigli operativi",
    purpose:
      "Raccoglie buone pratiche per Agenti e Utenti che lavorano sul campo con Eterya CRM, per mantenere dati affidabili e massimizzare l'efficacia commerciale.",
    steps: [
      "All'inizio della giornata: apri Dashboard → Centro Operativo → «Inizia la giornata» (Joy) e controlla l'Agenda.",
      "Prima di uscire: pianifica il giro visite e verifica geocoding e indirizzi.",
      "Durante le visite: registra l'incontro dalla scheda azienda appena concluso.",
      "A fine giornata: aggiorna stati commerciali, follow-up e note interne.",
      "Settimanalmente: rivedi aziende senza visita recente con i filtri ultima visita.",
      "Dopo ogni import Excel: verifica geocoding e revisione indirizzi ambigui.",
    ],
    tips: [
      "Annota sempre l'esito della visita nelle note: facilita il lavoro del team e dei report.",
      "Usa la priorità commerciale per ordinare l'elenco e concentrarti sui clienti più rilevanti.",
      "Sincronizza l'Agenda con Google Calendar se lavori su più dispositivi.",
      "Su mobile usa la bottom nav: Giro · Agenda · Joy (centrale) · Aziende · Altro.",
    ],
    errors: [
      {
        problem: "Dati disallineati tra Agente e ufficio.",
        solution:
          "Registra le attività direttamente nel CRM, non su fogli esterni. Evita duplicati importando elenchi già presenti.",
      },
    ],
  },
  {
    id: "prima-giornata-con-joy",
    title: "Prima giornata con Joy",
    purpose:
      "Percorso concreto per il primo giorno operativo: Dashboard → Joy Command Center → giro → visita → conferma. Solo funzioni già attive.",
    steps: [
      "Accedi e apri la Dashboard (/).",
      "Premi «Apri Joy» oppure tocca Joy nella nav mobile (pulsante centrale).",
      "Su /joy-ai leggi «Inizia la giornata» e premi Segui (oppure Organizza diversamente).",
      "Usa «Organizza il giro»: Joy propone tappe su dati CRM; Conferma apre /giro-visite — nessun salvataggio automatico.",
      "In visita: «Registra una visita» o scheda azienda → completa esito; se Joy propone un salvataggio, conferma esplicitamente.",
      "A fine giornata: da Joy Drive usa Fine giornata oppure chiedi un riepilogo; la memoria giorno resta sul dispositivo (Riprendi / Cancella).",
      "Se serve solo voce: apri /joy-ai/drive. Serve microfono + HTTPS; senza OPENAI_API_KEY la voce usa il fallback browser.",
    ],
    tips: [
      "Joy non inventa aziende né valori: se i dati mancano, lo dice e propone un’azione utile.",
      "Centro Operativo CRM (/command-center) è la timeline CRM classica; l’intelligenza Joy è solo su /joy-ai e /joy-ai/drive.",
      "Le route legacy /joy, /joy/chat e /joy/autonomous reindirizzano a /joy-ai.",
    ],
    errors: [
      {
        problem: "Joy non parla o voce robotica / a scatti.",
        solution:
          "Configura OPENAI_API_KEY per TTS coral (un MP3 continuo per risposta). Su /joy-ai usa «Test voce Joy» (A/B e Ripeti). Fallback browser solo senza chiave, errore TTS prima del play, offline o «Forza fallback browser» — mai a metà riproduzione OpenAI. Controlla Audio on e Interrompi.",
      },
      {
        problem: "Nessun consiglio nel Command Center.",
        solution:
          "Importa o crea aziende/visite/opportunità. Usa comunque i quattro pulsanti primari.",
      },
    ],
  },
  {
    id: "joy-ai",
    title: "JOY Command Center",
    purpose:
      "AI Sales Operating System: una sola interfaccia operativa che orchestra decision, radar, coach, sell-more-today, free-time, simulation e memoria giorno. CRM resta motore dati; mutazioni solo con conferma Copilot.",
    steps: [
      "Apri /joy-ai (menu JOY Command Center) o il pulsante centrale Joy nella nav mobile.",
      "Azioni primarie: Parla con Joy · Inizia la giornata · Organizza il giro · Registra una visita.",
      "Sezioni compatte: Ti consiglio adesso (max 3) · Priorità di oggi · Tempo libero utile · Prossima azione · Strategia commerciale (domande collegate ai motori, non risposte statiche).",
      "Memoria giorno discreta: Riprendi / Modifica / Cancella (localStorage, nessuna migration).",
      "Parla con Joy: microfono raggiungibile, transcript, TTS breve (~10s), Conferma / Modifica / Annulla senza saltare pagina.",
      "Joy Drive (/joy-ai/drive) resta la superficie vocale dedicata; stessi motori via joy-os.",
      "Dalla Dashboard usi «Apri Joy» + sintesi — non un secondo Command Center completo.",
    ],
    tips: [
      "Suggerimenti e snapshot passano da getJoyCommandCenterSnapshot / runJoyOsReasoning.",
      "Strategia: «Come aumentare il fatturato», «Come vendiamo di più oggi?», radar, simulazioni — sempre su dati CRM.",
      "Collaudo: JOY_OS_REVOLUTION_COLLAUDO.md.",
    ],
    errors: [
      {
        problem: "Quadro operativo vuoto o errore snapshot.",
        solution:
          "Riprova, usa Parla con Joy o i pulsanti primari. Verifica Supabase e dati commerciali popolati.",
      },
      {
        problem: "Microfono non disponibile.",
        solution:
          "Chrome/Edge + permesso microfono + HTTPS. In alternativa digita o apri Joy Drive.",
      },
      {
        problem: "Joy propone ma non salva.",
        solution:
          "Comportamento corretto: conferma sempre Copilot (Conferma / Modifica / Annulla).",
      },
    ],
  },
  {
    id: "joy-drive",
    title: "Joy Drive / JOY OS",
    purpose:
      "Superficie vocale mobile del Command Center. Joy OS (features/joy/os) orchestra i motori; Drive espone Parla / Inizia giornata / Registra / Organizza giro con TTS breve e conferma unificata.",
    steps: [
      "Apri /joy-ai/drive, dal link «Joy Drive (voce)» nel Command Center, o da Centro Operativo → Apri Joy.",
      "Home allineata al Command Center: Parla con Joy, Inizia la giornata, Registra una visita, Organizza il giro + Agenda/Giro/Aziende/Altro.",
      "Memoria operativa giorno in localStorage; Reset giorno la cancella.",
      "Conferma Copilot vocale: «conferma» / «annulla». Nessuna mutazione automatica.",
    ],
    tips: [
      "Usa Chrome o Edge su smartphone; concedi microfono e GPS.",
      "Checklist: JOY_OS_REVOLUTION_COLLAUDO.md.",
    ],
    errors: [
      {
        problem: "Microfono non parte.",
        solution: "Permesso microfono, HTTPS, oppure digita il comando.",
      },
      {
        problem: "Voce di Joy assente.",
        solution: "Serve Speech Synthesis; il testo completo resta a schermo.",
      },
    ],
  },
  {
    id: "gestione-utenti-permessi",
    title: "Gestione utenti e permessi",
    purpose:
      "Consente all'Amministratore di creare, modificare e disattivare gli account, assegnare i ruoli e consultare la matrice dei permessi per ruolo.",
    steps: [
      "Dal menu Amministrazione seleziona Utenti (/admin/users).",
      "Crea un nuovo utente con nome, email, ruolo e password provvisoria (oppure invito via email).",
      "Modifica un utente per cambiarne il ruolo o lo stato (attivo/disattivato).",
      "Apri Ruoli e permessi (/admin/permissions) per consultare la matrice delle capacità per ruolo.",
      "Le azioni su utenti vengono registrate nell'Audit Log.",
    ],
    tips: [
      "I ruoli disponibili: Super amministratore, Amministratore, Manager, Agente, Sola lettura.",
      "I permessi non si configurano singolarmente: derivano dal ruolo assegnato.",
      "Non puoi disattivare il tuo stesso account.",
    ],
    errors: [
      {
        problem: "«Service role non configurata».",
        solution:
          "Per creare utenti serve SUPABASE_SERVICE_ROLE_KEY in .env.local (solo server, mai nel client).",
      },
      {
        problem: "Accesso negato all'area Amministrazione.",
        solution: "L'area è riservata ai ruoli Super amministratore e Amministratore.",
      },
    ],
  },
  {
    id: "configurazione-azienda",
    title: "Configurazione Azienda",
    purpose:
      "Raccoglie i dati dell'organizzazione (ragione sociale, P.IVA, contatti) e i default operativi (valuta, validità preventivi) usati dal CRM.",
    steps: [
      "Dal menu Amministrazione seleziona Configurazione (/configurazione).",
      "Compila ragione sociale, P.IVA, indirizzo, email, telefono e sito web.",
      "Imposta la valuta predefinita e la validità standard dei preventivi in giorni.",
      "Salva: le modifiche vengono tracciate nell'Audit Log.",
    ],
    tips: [
      "La configurazione è unica per l'organizzazione (modello single-tenant).",
      "La valuta predefinita è usata come riferimento nelle nuove trattative.",
    ],
    errors: [
      {
        problem: "«Tabella configurazione non trovata».",
        solution:
          "Esegui la migrazione 20260715_app_settings.sql su Supabase.",
      },
    ],
  },
  {
    id: "backup-e-ripristino",
    title: "Backup e Ripristino",
    purpose:
      "Permette all'Amministratore di esportare tutti i dati del CRM in un file JSON e di ripristinare i record mancanti da un backup precedente, in modo non distruttivo.",
    steps: [
      "Dal menu Amministrazione seleziona Backup (/backup).",
      "Usa Esporta backup JSON per scaricare un file con tutti i dati principali.",
      "Per ripristinare, seleziona un file di backup, spunta la conferma e usa Ripristina da file.",
      "Consulta il riepilogo record per tabella al termine dell'operazione.",
    ],
    tips: [
      "Il ripristino è non distruttivo: inserisce solo i record mancanti (per identificativo) e non modifica né elimina i dati esistenti.",
      "I file fisici allegati non sono inclusi nel backup JSON (solo i riferimenti).",
      "Conserva i backup in un luogo sicuro: contengono dati sensibili.",
    ],
    errors: [
      {
        problem: "Il ripristino non importa nulla.",
        solution:
          "I record con identificativo già presente vengono ignorati: è il comportamento previsto per non sovrascrivere i dati.",
      },
    ],
  },
  {
    id: "audit-log",
    title: "Audit Log",
    purpose:
      "Registra le azioni chiave del CRM (gestione utenti, configurazione, backup e ripristino) con data, autore, azione ed entità coinvolta.",
    steps: [
      "Dal menu Amministrazione seleziona Audit Log (/audit-log).",
      "Consulta l'elenco cronologico degli eventi con azione, entità, dettaglio e autore.",
      "Usa il registro per verificare chi ha effettuato una determinata operazione.",
    ],
    tips: [
      "Il log è append-only: gli eventi non possono essere modificati dall'applicazione.",
      "Le azioni su utenti, configurazione e backup vengono registrate automaticamente.",
    ],
    errors: [
      {
        problem: "«Tabella audit non trovata».",
        solution: "Esegui la migrazione 20260715_audit_logs.sql su Supabase.",
      },
    ],
  },
  {
    id: "risoluzione-dei-problemi",
    title: "Risoluzione dei problemi",
    purpose:
      "Guida rapida per i problemi più frequenti riscontrati da Agente, Utente e Amministratore durante l'utilizzo quotidiano del CRM.",
    steps: [
      "Identifica il messaggio di errore o il comportamento anomalo.",
      "Ricarica la pagina (F5 o pull-to-refresh su mobile).",
      "Verifica la connessione internet.",
      "Prova in una finestra in incognito per escludere estensioni browser.",
      "Se il problema riguarda dati mancanti, controlla filtri attivi e permessi account.",
      "Se persiste, annota ora, pagina, azione eseguita e screenshot per l'Amministratore.",
    ],
    tips: [
      "Molti errori di caricamento si risolvono con un refresh dopo modifiche alla configurazione.",
      "Su mobile, chiudi e riapri il browser se la mappa o il GPS smettono di rispondere.",
      "Consulta la sezione specifica di questo manuale per errori legati a una funzione.",
    ],
    errors: [
      {
        problem: "«Database non configurato» su più pagine.",
        solution:
          "L'Amministratore deve verificare .env.local (Supabase URL e chiave anon) e riavviare l'applicazione.",
      },
      {
        problem: "Sessione scaduta / redirect al login.",
        solution:
          "Effettua nuovamente l'accesso. Se accade spesso, verifica che l'orologio del dispositivo sia corretto.",
      },
      {
        problem: "Pagina lenta con molte aziende.",
        solution:
          "Usa filtri e paginazione. Evita di aprire più schede pesanti (Mappa + Giro visite) su dispositivi con poca memoria.",
      },
      {
        problem: "Funzione non visibile nel menu.",
        solution:
          "Alcune voci dipendono dal ruolo. L'Amministratore vede la sezione Amministrazione; gli altri ruoli hanno menu ridotto.",
      },
    ],
  },
  {
    id: "sicurezza",
    title: "Sicurezza",
    purpose:
      "Descrive le misure di sicurezza del CRM e le responsabilità di Agente, Utente e Amministratore nella protezione dei dati commerciali e personali.",
    steps: [
      "Usa sempre credenziali personali: non condividere email e password.",
      "Effettua il logout su dispositivi condivisi o pubblici.",
      "Non salvare la password del CRM nel browser su PC non affidabili.",
      "Segnala immediatamente all'Amministratore accessi sospetti o account compromessi.",
      "L'Amministratore gestisce creazione, disattivazione e ruoli utente da Amministrazione.",
      "Non inserire credenziali di terze parti (API, email) nei campi note delle aziende.",
    ],
    tips: [
      "Preferisci password lunghe e uniche, diverse da altri servizi.",
      "La chiave service role Supabase va usata solo lato server: mai esporla nel client o in repository pubblici.",
      "I dati delle aziende (P.IVA, email, telefono) sono informazioni sensibili: trattali secondo la policy aziendale.",
    ],
    errors: [
      {
        problem: "Account disattivato.",
        solution:
          "Contatta l'Amministratore per verificare lo stato dell'utente nel pannello Amministrazione.",
      },
      {
        problem: "Accesso negato a una sezione.",
        solution:
          "Il ruolo assegnato potrebbe non includere quel permesso. Chiedi all'Amministratore un adeguamento del ruolo.",
      },
    ],
  },
];

export const MANUAL_VERSION = "2.6";
