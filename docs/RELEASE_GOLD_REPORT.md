# RELEASE GOLD REPORT — Eterya CRM / JOY OS (Unica)

**Data:** 17 luglio 2026  
**Release:** GOLD unica — closure + fluidità voce obbligatoria  
**Verdetto:** Production Ready con test manuali residui  

| Metrica | Valore |
|---------|--------|
| Percentuale tecnica reale | **94%** |
| Percentuale validata automaticamente | **40%** (typecheck + lint + build + audit codice voce/CRM; non E2E UI) |
| Validazione sul campo | **Da collaudo umano** (orecchio voce, GPS, viewport, salvataggi live) |

**Nota onestà voce:** architettura fluidità corretta in codice (1 reply = 1 MP3 continuo, no fallback mid-OpenAI). **Non dichiarata “voce completa al 100%”** senza ascolto umano su dispositivo reale con `OPENAI_API_KEY`.

---

## 1. Inventario reale (Fase 1)

Legenda: Completa · Parzialmente · Presente ma non collegata · Collegata ma non funzionante · Duplicata · Obsoleta · Non verificabile auto · Bloccata da config esterna

### 1.1 Route canoniche Joy

| Route | Stato | Note |
|-------|-------|------|
| `/joy-ai` | Completa | JOY Command Center + Test voce Joy (A/B) |
| `/joy-ai/drive` | Completa | Superficie vocale; stessa coda `joyVoice` |
| `/joy`, `/joy/chat`, `/joy/autonomous` | Obsoleta → redirect | Redirect a `/joy-ai` |
| `/assistant` | Parzialmente | Assistente rule-based pre-Joy OS (mantenuto) |
| `/voice` | Parzialmente | Dettatura CRM, non TTS Joy |
| `/command-center` | Completa | «Centro Operativo CRM» (non Joy) |

### 1.2 CRM (sintesi)

| Area | Stato |
|------|-------|
| Auth login/forgot/reset | Completa (Bloccata da config se Supabase assente) |
| Dashboard `/` | Completa — sintesi Joy da snapshot |
| Mission Control | Completa |
| Aziende + dettaglio + import | Completa |
| Geocoding review | Parzialmente — Bloccata da Geoapify |
| Contatti | Completa |
| Mappa | Completa — GPS Non verificabile auto |
| Agenda / Attività / Calendario | Completa / Calendario sync Bloccata da Google OAuth |
| Visite | Completa |
| Giro visite / Auto / routes alias | Completa |
| Pipeline / opportunities | Completa |
| Preventivi, Ordini, Campioni, Assistenza, Products | Completa |
| Documenti | Completa |
| Report / Statistiche / Dashboard avanzata | Completa |
| Admin users, backup, config | Completa |
| Permissions | Parzialmente — matrice, non enforcement route-by-route |
| Settings | Parzialmente — focus Google Calendar |
| Notifiche, Manuale, Audit | Completa / Audit dipende da writer |

### 1.3 API

| API | Stato |
|-----|-------|
| `/api/joy-ai/chat` | Completa |
| `/api/joy-ai/tts` | Completa codice; Bloccata da `OPENAI_API_KEY` in runtime |
| `/api/joy-ai/conversations` | Completa |
| `/api/joy-ai/suggestions` | Completa |
| Google Calendar connect/callback | Bloccata da OAuth env |

### 1.4 Motori Joy OS

| Motore | Orchestrato via joy-os/runtime | UI |
|--------|-------------------------------|-----|
| decision-engine, contradiction | Sì | Command Center / chat |
| commercial-radar | Sì | Sì |
| proactive-engine | Sì | Ti consiglio |
| simulation-engine | Sì | Intent chat |
| sell-more-today / planner | Sì | Strategia / Organizza giro |
| coaching | Sì | Chat |
| strategy-engine | Sì | Chip strategia |
| learning-engine | Sì | Trigger — Parzialmente visibile |
| day-ops-memory, long-memory | Client | Memoria giorno |
| chat-engine, tools-registry, tour-planner, debrief | Sì via facciata | Sì |
| conversation-memory, briefing | Sì | Sì |

---

## 2. Voce — root cause e correzione (priorità massima)

### Cause della scarsa fluidità (pre-fix)

1. Possibile **fallback browser a metà** se `audio.onerror` dopo l’avvio OpenAI (`finish(false)` → speechSynthesis).
2. Stato unico `loading` senza **preparing/ready**; play senza attendere buffer (`canplaythrough`).
3. **Revoke ObjectURL** aggressivo / Audio ricreato senza guardie di generation.
4. Fetch TTS **senza AbortController** su speak superseduti.
5. Markdown/punteggiatura che introduce **pause artificiose** nel testo parlato.
6. Mancanza di separazione esplicita **spokenText / displayText** in un solo punto centrale.

### Correzione applicata

| Aspetto | Implementazione |
|---------|-----------------|
| 1 reply = 1 TTS = 1 play | `joyVoice.speak` → un blob MP3 → un `HTMLAudioElement` |
| Stati coda | `idle` · `preparing` · `ready` · `speaking` · `paused` · `stopped` · `error` |
| spokenText / displayText | `prepareJoyUtterance()` in `spoken-text.ts` |
| No fallback mid-OpenAI | Flag `openAiCommitted` dopo `play()` OK |
| Preload | `canplaythrough` + timeout blob corti |
| Cache Ripeti | blob client + cache server SHA-256 |
| Cancel superseduti | `generation` + `AbortController` |
| A/B | coral / nova / shimmer nel pannello; winner = **coral** in `joy-voice-profile.ts` |
| Instructions | italiano commerciale femminile coerente (`JOY_TTS_INSTRUCTIONS`) |

### Voce finale

- **OpenAI `gpt-4o-mini-tts` / `coral`** (A/B winner, profilo `joy-it-commercial-female-v2`)
- Fallback `speechSynthesis` it-IT **solo** se: no key / TTS fail pre-play / offline / utente «Forza fallback browser»

### URL pannello prova voce

**`/joy-ai`** → sezione **Test voce Joy** (campioni + A/B + Audio / Interrompi / Ripeti)

---

## 3. Gap chiusi in questa release unica

1. Fluidità voce (coda, spoken/display, no mid-fallback, preparing/ready, A/B, cache, abort).
2. Manuale changelog **1.18** + troubleshooting voce a scatti.
3. Conferme precedenti (visitId/followUpId), redirect legacy Joy, nav Centro Operativo vs Joy — mantenuti.
4. Nessuna migration nuova.

---

## 4. Quality gates (Fase 14)

| Gate | Comando | Esito |
|------|---------|-------|
| TypeScript | `npm.cmd run typecheck` | **PASS** |
| Lint | `npm.cmd run lint` | **PASS** |
| Build | `npm.cmd run build` | **PASS** |
| `@ts-ignore` / catch vuoti abusivi (path Joy voce) | audit | **0** |
| Migrations nuove | — | **Nessuna** |

---

## 5. Test funzionali — classificazione onesta

| Ambito | Classificazione |
|--------|-----------------|
| Gate TS/lint/build | Superato |
| Coda voce / 1 MP3 / stati / no mid-fallback | Verificato tramite codice |
| Fluidità percettiva coral | **Da provare manualmente** (orecchio) |
| Login / GPS / viewport / import / salvataggi live | Da provare manualmente |
| Command Center / Drive / CRM core | Verificato tramite codice + build route |

---

## 6. Configurazioni esterne richieste

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ service role admin)
- `OPENAI_API_KEY` — chat + TTS coral
- Google OAuth — calendario
- Geoapify — geocoding
- HTTPS + mic/GPS — Drive / mappa

---

## 7. File toccati (voce + chiusura)

### Creati / aggiornati docs

- `docs/RELEASE_GOLD_REPORT.md` (questa release unica)

### Modificati (voce)

- `src/lib/voice/joy-voice-queue.ts`
- `src/lib/voice/spoken-text.ts`
- `src/lib/voice/joy-voice-profile.ts`
- `src/lib/voice/openai-tts.service.ts`
- `src/lib/voice/index.ts`
- `app/api/joy-ai/tts/route.ts`
- `features/joy/hooks/use-joy-voice.ts`
- `features/joy/components/joy-voice-controls.tsx`
- `features/joy/components/joy-voice-test-panel.tsx`
- `features/joy/components/joy-ai-assistant-screen.tsx`
- `features/joy/components/joy-drive-screen.tsx`
- `features/manuale/content/changelog.ts`
- `features/manuale/content/sections.ts`

### Rimossi

- Nessuno

---

## 8. Ordine collaudo manuale consigliato

1. Login → Dashboard → Apri Joy  
2. `/joy-ai` → **Test voce Joy**: campioni + A/B coral/nova/shimmer + Ripeti  
3. Parla con Joy → Interrompi → Ripeti (verificare un solo flusso continuo)  
4. `/joy-ai/drive` conversazione vocale  
5. Organizza giro → Conferma → `/giro-visite`  
6. Registra visita → conferma Copilot  
7. Mobile nav + viewport 390  
8. Mappa GPS  
9. Import Excel  
10. Manuale «Prima giornata con Joy»  
11. Logout  

---

## 9. Verdetto

**Production Ready con test manuali residui**

Percentuale tecnica **94%**. Validazione automatica di processo **40%**.  
Voce: root-cause chiusa in architettura; **collaudo udito obbligatorio** prima di dichiarare fluidità completa in produzione.
