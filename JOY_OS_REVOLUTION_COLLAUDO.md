# JOY OS — Command Center Collaudo Checklist

Checklist per verificare che Joy sia **una sola intelligenza** operativa (Command Center + Drive), orchestrata da `features/joy/os` (`joy-runtime` / `getJoyCommandCenterSnapshot`). CRM resta motore dati; nessuna mutazione senza conferma.

## A. Gate e qualità

- [ ] `npx tsc --noEmit` verde
- [ ] `npm.cmd run lint` verde
- [ ] `npm.cmd run build` verde
- [ ] `/joy-ai` = JOY Command Center (sottotitolo AI Sales Operating System)
- [ ] `/joy-ai/drive` raggiungibile come superficie vocale
- [ ] `joy-os` barrel usato da chat-engine, suggestions, dashboard (non dead export)

## B. Command Center (`/joy-ai`)

- [ ] 4 azioni primarie: **Parla con Joy** | **Inizia la giornata** | **Organizza il giro** | **Registra una visita**
- [ ] Sezioni: Ti consiglio adesso (max 3) · Priorità · Tempo libero utile (max 3) · Prossima azione · Strategia (motori reali)
- [ ] Inizia la giornata: raccomandazione + Segui / Organizza diversamente / Parla / Ignora
- [ ] Card consiglio: Esegui / Spiegami / Ignora + urgenza/distanza/tempo/valore se disponibili
- [ ] Memoria giorno: Riprendi / Modifica / Cancella
- [ ] TTS breve (~&lt;10s) sulle risposte; mic raggiungibile
- [ ] Conferma Copilot unificata (nessun auto-save)

## C. Mobile nav + Dashboard

- [ ] Bottom nav: Giro | Agenda | **Joy** (centrale) | Aziende | Altro
- [ ] Viewport 360 / 390 / 430: azioni e mic usabili
- [ ] Dashboard: **Apri Joy** + sintesi (non duplicato Command Center)

## D. Motori orchestrati via joy-os

- [ ] decision-engine, commercial-radar, proactive-engine, simulation, sell-more-today
- [ ] day-ops-memory (client), runtime, coach, tour-planner/debrief/chat-engine via facciata
- [ ] conversation-memory, get-company-briefing, tools-registry raggiungibili dal flusso Joy
- [ ] Nessuna inventazione dati; errori con fallback parlabili

## E. Limiti onesti

- [ ] Nessuna migration / SQL eseguita da Joy
- [ ] Nessuna nuova feature commerciale inventata
- [ ] Auth / Google Calendar / Gmail non toccati in questo scope
- [ ] Pagine CRM esistenti non eliminate

## F. Manuale

- [ ] Sezione JOY Command Center + Joy Drive aggiornate
- [ ] Changelog 1.16 presente

---

**Esito atteso:** l’agente percepisce una sola intelligenza Joy, non moduli separati.
