import {
  intentRequiresConfirmation,
  isCancelUtterance,
  isConfirmUtterance,
  isForbiddenVoiceDeletion,
} from "./confirmation-rules";
import { formatItalianDateSpoken, parseItalianRelativeDate } from "./italian-dates";
import type {
  JoyGuideScreenContext,
  JoyVoiceIntentResult,
  JoyVoiceIntentType,
} from "./types";
import { JOY_GUIDE_CONFIDENCE_MIN } from "./types";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function result(
  partial: Omit<JoyVoiceIntentResult, "requiresConfirmation"> & {
    requiresConfirmation?: boolean;
  }
): JoyVoiceIntentResult {
  const intent = partial.intent;
  const requiresConfirmation =
    partial.requiresConfirmation ?? intentRequiresConfirmation(intent);
  return {
    ...partial,
    requiresConfirmation,
    companyId: partial.companyId ?? null,
    entities: partial.entities ?? {},
    proposedAction: partial.proposedAction ?? null,
    clarifyQuestion: partial.clarifyQuestion ?? null,
  };
}

function extractCompanyQuery(
  text: string,
  patterns: RegExp[]
): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const q = match[1].replace(/[?.!,;:]+$/g, "").trim();
      if (q.length >= 2) return q;
    }
  }
  return null;
}

const BRAND_ALIASES: Record<string, string> = {
  eterya: "Eterya",
  palagina: "Palagina",
  zanzar: "Zanzar",
  vepa: "VEPA",
};

function extractBrandName(normalized: string): string | null {
  for (const [alias, label] of Object.entries(BRAND_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(normalized)) {
      return label;
    }
  }
  const match = normalized.match(
    /\b(?:aggiungi|rimuovi|brand|segna)\s+([a-z0-9]+)/i
  );
  if (match?.[1] && match[1].length >= 3) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  return null;
}

function contextCompany(
  ctx: JoyGuideScreenContext | undefined
): { id: string | null; name: string | null } {
  return {
    id: ctx?.companyId ?? null,
    name: ctx?.companyName ?? null,
  };
}

/**
 * Typed voice intent router for Release 2 guide mode.
 * Pure function — no I/O.
 */
export function parseJoyVoiceIntent(
  utterance: string,
  context?: JoyGuideScreenContext,
  now: Date = new Date()
): JoyVoiceIntentResult {
  const raw = utterance.trim();
  const n = normalize(raw);

  if (!n) {
    return result({
      intent: "clarify",
      confidence: 1,
      companyId: null,
      entities: {},
      spokenReply: "Non ho sentito bene. Ripeti il comando.",
      interpretation: "Vuoto",
      proposedAction: null,
      clarifyQuestion: "Cosa vuoi fare?",
    });
  }

  if (isForbiddenVoiceDeletion(raw)) {
    return result({
      intent: "clarify",
      confidence: 1,
      companyId: null,
      entities: {},
      spokenReply:
        "In modalità guida non posso cancellare dati in modo definitivo. Dimmi un'altra azione.",
      interpretation: "Cancellazione non consentita in R2",
      proposedAction: null,
    });
  }

  if (isConfirmUtterance(raw)) {
    return result({
      intent: "confirm",
      confidence: 0.99,
      companyId: context?.companyId ?? null,
      entities: {},
      spokenReply: "Confermato.",
      interpretation: "Conferma",
      proposedAction: "Conferma azione",
      requiresConfirmation: false,
    });
  }

  if (isCancelUtterance(raw)) {
    return result({
      intent: "cancel",
      confidence: 0.99,
      companyId: null,
      entities: {},
      spokenReply: "Ok, annullo.",
      interpretation: "Annulla",
      proposedAction: "Annulla",
      requiresConfirmation: false,
    });
  }

  // 1. Agenda oggi
  if (
    /leggimi (gli )?appuntament/.test(n) ||
    /appuntamenti di oggi/.test(n) ||
    /cosa devo fare (oggi|domani)/.test(n) ||
    /ho appuntamenti/.test(n) ||
    /follow[- ]?up (sono )?scadut/.test(n) ||
    /agenda (di )?oggi/.test(n)
  ) {
    return result({
      intent: "read_agenda_today",
      confidence: 0.95,
      companyId: null,
      entities: {},
      spokenReply: "Ti leggo un riepilogo dell'agenda.",
      interpretation: "Lettura agenda",
      proposedAction: "Leggi agenda oggi",
    });
  }

  // 2. Apri giro di oggi
  if (
    /apri (il )?giro/.test(n) ||
    /giro (di )?oggi/.test(n) ||
    /leggimi (il )?giro/.test(n) ||
    /organizza (il )?giro/.test(n)
  ) {
    return result({
      intent: "open_tour_today",
      confidence: 0.94,
      companyId: null,
      entities: {},
      spokenReply: "Apro il giro di oggi.",
      interpretation: "Apri giro visite oggi",
      proposedAction: "Apri giro di oggi",
    });
  }

  // 3. Prossima tappa / visita
  if (
    /qual[e' ]* (e |è )?la prossima (tappa|visita)/.test(n) ||
    /prossima (tappa|visita)\??$/.test(n) ||
    /quale (e |è )?la prossima/.test(n)
  ) {
    return result({
      intent: "next_stop",
      confidence: 0.95,
      companyId: context?.nextStopCompanyId ?? null,
      entities: {
        companyId: context?.nextStopCompanyId ?? null,
        companyQuery: context?.nextStopName ?? null,
      },
      spokenReply: context?.nextStopName
        ? `La prossima tappa è ${context.nextStopName}.`
        : "Controllo la prossima tappa del giro.",
      interpretation: "Prossima tappa",
      proposedAction: "Leggi prossima tappa",
    });
  }

  // 4. Navigazione prossima / portami
  if (
    /portami dal prossimo/.test(n) ||
    /avvia (la )?prossima tappa/.test(n) ||
    /naviga (verso |dal )?prossim/.test(n) ||
    /portami (dal |alla )?prossim/.test(n)
  ) {
    return result({
      intent: "navigate_next",
      confidence: 0.96,
      companyId: context?.nextStopCompanyId ?? null,
      entities: {
        companyId: context?.nextStopCompanyId ?? null,
        companyQuery: context?.nextStopName ?? null,
      },
      spokenReply:
        "Ho preparato la navigazione. Tocca Avvia navigazione.",
      interpretation: "Navigazione prossima tappa",
      proposedAction: "Prepara Google Maps",
    });
  }

  // Portami da <azienda>
  const navigateCompany = extractCompanyQuery(n, [
    /portami (?:da|dal|dalla|verso)\s+(.+)$/i,
    /naviga (?:verso|da|dal)\s+(.+)$/i,
    /avvia navigazione (?:verso|da|per)\s+(.+)$/i,
  ]);
  if (navigateCompany) {
    return result({
      intent: "navigate_company",
      confidence: 0.9,
      companyId: null,
      entities: { companyQuery: navigateCompany },
      spokenReply: `Cerco ${navigateCompany} e preparo la navigazione.`,
      interpretation: `Navigazione verso ${navigateCompany}`,
      proposedAction: "Prepara Google Maps",
    });
  }

  // 5–6. Cerca / Apri scheda
  const searchQuery = extractCompanyQuery(n, [
    /cerca\s+(.+)$/i,
    /trova\s+(.+)$/i,
    /fammi vedere\s+(.+)$/i,
  ]);
  if (searchQuery && !/clienti|vicino|brand/.test(searchQuery)) {
    return result({
      intent: "search_company",
      confidence: 0.92,
      companyId: null,
      entities: { companyQuery: searchQuery },
      spokenReply: `Cerco ${searchQuery}.`,
      interpretation: `Ricerca azienda: ${searchQuery}`,
      proposedAction: "Cerca azienda",
    });
  }

  const openQuery = extractCompanyQuery(n, [
    /apri (?:la )?scheda (?:di |del |della )?(.+)$/i,
    /apri\s+(.+)$/i,
  ]);
  if (openQuery && !/giro|agenda|whatsapp|maps/.test(openQuery)) {
    return result({
      intent: "open_company",
      confidence: 0.91,
      companyId: null,
      entities: { companyQuery: openQuery },
      spokenReply: `Apro la scheda di ${openQuery}.`,
      interpretation: `Apri scheda: ${openQuery}`,
      proposedAction: "Apri scheda azienda",
    });
  }

  // 7. Registra visita
  if (
    /registra visita/.test(n) ||
    /aggiungi nota (alla )?visita/.test(n) ||
    (/ho finito (la )?visita/.test(n) && !/completata/.test(n))
  ) {
    const company = contextCompany(context);
    if (!company.id && !company.name) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: null,
        entities: {},
        spokenReply: "Di quale azienda vuoi registrare la visita?",
        interpretation: "Registra visita — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Di quale azienda?",
      });
    }
    return result({
      intent: "register_visit",
      confidence: 0.93,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
      },
      spokenReply: "Dimmi com'è andata.",
      interpretation: "Registra visita",
      proposedAction: "Avvia debrief visita",
      requiresConfirmation: true,
    });
  }

  // 8. Visita completata
  if (
    /visita completata/.test(n) ||
    /completa (la )?visita/.test(n) ||
    /segna (come )?completata/.test(n) ||
    /ho finito (la )?visita/.test(n)
  ) {
    const company = contextCompany(context);
    if (!company.id) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: null,
        entities: {},
        spokenReply: "Quale visita vuoi completare? Dimmi l'azienda.",
        interpretation: "Completa visita — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Quale azienda?",
      });
    }
    return result({
      intent: "complete_visit",
      confidence: 0.92,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
        notes: raw,
      },
      spokenReply: "Dimmi com'è andata, poi ti chiedo conferma prima di salvare.",
      interpretation: "Completa visita",
      proposedAction: "Completa visita (con conferma)",
      requiresConfirmation: true,
    });
  }

  // 9. Richiama tra N giorni / follow-up
  if (
    /richiama/.test(n) ||
    /crea (un )?follow[- ]?up/.test(n) ||
    /follow[- ]?up/.test(n) ||
    /ricordamelo/.test(n)
  ) {
    const dateIso = parseItalianRelativeDate(raw, now);
    const company = contextCompany(context);
    if (!company.id) {
      return result({
        intent: "clarify",
        confidence: 0.75,
        companyId: null,
        entities: { followUpDate: dateIso },
        spokenReply: "Per quale azienda creo il follow-up?",
        interpretation: "Follow-up — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Quale azienda?",
      });
    }
    if (!dateIso) {
      return result({
        intent: "clarify",
        confidence: 0.75,
        companyId: company.id,
        entities: { companyId: company.id },
        spokenReply: "Quando vuoi il richiamo? Per esempio: tra dieci giorni.",
        interpretation: "Follow-up — manca data",
        proposedAction: null,
        clarifyQuestion: "Quando?",
      });
    }
    const spokenDate = formatItalianDateSpoken(dateIso);
    return result({
      intent: "create_follow_up",
      confidence: 0.9,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
        followUpDate: dateIso,
        notes: raw,
      },
      spokenReply: `Propongo un richiamo per ${company.name ?? "l'azienda"} il ${spokenDate}. Confermi?`,
      interpretation: `Follow-up ${spokenDate}`,
      proposedAction: "Crea follow-up",
      requiresConfirmation: true,
    });
  }

  // 10. Ricordami / promemoria
  if (/ricordami/.test(n) || /crea (un )?promemoria/.test(n) || /promemoria/.test(n)) {
    const dateIso = parseItalianRelativeDate(raw, now);
    const reminderText = raw
      .replace(/ricordami (di )? /i, "")
      .replace(/crea (un )?promemoria/i, "")
      .trim();
    const company = contextCompany(context);
    if (!dateIso) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: company.id,
        entities: { reminderText },
        spokenReply: "Per quando? Dimmi un giorno, per esempio venerdì.",
        interpretation: "Promemoria — manca data",
        proposedAction: null,
        clarifyQuestion: "Per quando?",
      });
    }
    return result({
      intent: "create_reminder",
      confidence: 0.88,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
        reminderDate: dateIso,
        reminderText: reminderText || raw,
      },
      spokenReply: `Propongo un promemoria per ${formatItalianDateSpoken(dateIso)}. Confermi?`,
      interpretation: "Crea promemoria",
      proposedAction: "Crea promemoria",
      requiresConfirmation: true,
    });
  }

  // 11. Quali brand
  if (
    /quali brand/.test(n) ||
    /che brand/.test(n) ||
    /brand (ha|di) (questa )?aziend/.test(n)
  ) {
    const company = contextCompany(context);
    if (!company.id) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: null,
        entities: {},
        spokenReply: "Di quale azienda vuoi sapere i brand?",
        interpretation: "Lista brand — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Quale azienda?",
      });
    }
    return result({
      intent: "list_brands",
      confidence: 0.94,
      companyId: company.id,
      entities: { companyId: company.id, companyQuery: company.name },
      spokenReply: "Controllo i brand di questa azienda.",
      interpretation: "Lista brand",
      proposedAction: "Leggi brand",
    });
  }

  // 12. Aggiungi brand / segna come cliente
  if (
    /aggiungi\s+\w+/.test(n) ||
    /segna come cliente/.test(n) ||
    /imposta .+ come brand principale/.test(n) ||
    /rimuovi\s+\w+/.test(n)
  ) {
    const brandName = extractBrandName(n);
    const company = contextCompany(context);
    if (!company.id) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: null,
        entities: { brandName },
        spokenReply: "A quale azienda vuoi aggiungere il brand?",
        interpretation: "Aggiungi brand — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Quale azienda?",
      });
    }
    if (!brandName) {
      return result({
        intent: "clarify",
        confidence: 0.65,
        companyId: company.id,
        entities: {},
        spokenReply: "Quale brand? Eterya, Palagina o Zanzar?",
        interpretation: "Aggiungi brand — manca nome",
        proposedAction: null,
        clarifyQuestion: "Quale brand?",
      });
    }
    if (/rimuovi/.test(n)) {
      return result({
        intent: "clarify",
        confidence: 0.9,
        companyId: company.id,
        entities: { brandName, companyId: company.id },
        spokenReply:
          "In modalità guida non rimuovo brand senza conferma da scheda. Posso solo proporre aggiunte.",
        interpretation: "Rimozione brand non in R2 voce",
        proposedAction: null,
      });
    }
    const asPrimary = /principale|primary/.test(n);
    const asCliente = /cliente/.test(n);
    return result({
      intent: asCliente ? "set_brand_status" : "add_brand",
      confidence: 0.9,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
        brandName,
        relationshipStatus: asCliente ? "cliente" : undefined,
        notes: asPrimary ? "primary" : null,
      },
      spokenReply: `Vuoi aggiungere ${brandName} a ${company.name ?? "questa azienda"}? Conferma per salvare.`,
      interpretation: `Aggiungi brand ${brandName}`,
      proposedAction: `Aggiungi ${brandName}`,
      requiresConfirmation: true,
    });
  }

  // Call / WhatsApp / email
  if (/chiama/.test(n)) {
    const company = contextCompany(context);
    if (!company.id) {
      return result({
        intent: "clarify",
        confidence: 0.7,
        companyId: null,
        entities: {},
        spokenReply: "Chi vuoi chiamare? Dimmi l'azienda.",
        interpretation: "Chiama — manca azienda",
        proposedAction: null,
        clarifyQuestion: "Quale azienda?",
      });
    }
    return result({
      intent: "call_contact",
      confidence: 0.9,
      companyId: company.id,
      entities: { companyId: company.id, companyQuery: company.name },
      spokenReply: "Ho preparato la chiamata. Tocca Chiama.",
      interpretation: "Prepara chiamata",
      proposedAction: "Chiama",
    });
  }

  if (/whatsapp/.test(n)) {
    const company = contextCompany(context);
    return result({
      intent: "open_whatsapp",
      confidence: 0.88,
      companyId: company.id,
      entities: { companyId: company.id, companyQuery: company.name },
      spokenReply: "Ho preparato WhatsApp. Tocca Apri WhatsApp.",
      interpretation: "Prepara WhatsApp",
      proposedAction: "Apri WhatsApp",
    });
  }

  if (/invia (una )?mail/.test(n) || /prepara (una )?mail/.test(n) || /email/.test(n)) {
    const company = contextCompany(context);
    return result({
      intent: "prepare_email",
      confidence: 0.85,
      companyId: company.id,
      entities: { companyId: company.id, companyQuery: company.name },
      spokenReply: "Ho preparato l'email. Tocca Apri email.",
      interpretation: "Prepara email",
      proposedAction: "Apri email",
    });
  }

  // Debrief-like free text while registering: treat as visit note draft
  if (context?.visitStatus === "awaiting_debrief" && n.length > 8) {
    const company = contextCompany(context);
    const dateIso = parseItalianRelativeDate(raw, now);
    return result({
      intent: "complete_visit",
      confidence: 0.8,
      companyId: company.id,
      entities: {
        companyId: company.id,
        companyQuery: company.name,
        notes: raw,
        followUpDate: dateIso,
        outcome: /interessat|positivo|ok|bene/.test(n)
          ? "positivo"
          : /negativ|non interessat|perso/.test(n)
            ? "negativo"
            : "da_valutare",
        products: Object.values(BRAND_ALIASES).filter((b) =>
          n.includes(normalize(b))
        ),
        quoteRequested: /preventiv/.test(n),
      },
      spokenReply: buildDebriefSummarySpoken(raw, dateIso),
      interpretation: "Debrief visita (bozza)",
      proposedAction: "Salva visita (conferma)",
      requiresConfirmation: true,
    });
  }

  return result({
    intent: "unknown",
    confidence: 0.2,
    companyId: context?.companyId ?? null,
    entities: {},
    spokenReply:
      "Non ho capito. Prova: agenda di oggi, prossima tappa, cerca un'azienda, o registra visita.",
    interpretation: "Intent sconosciuto",
    proposedAction: null,
    clarifyQuestion: "Ripeti in modo più semplice?",
  });
}

function buildDebriefSummarySpoken(raw: string, dateIso: string | null): string {
  const bits: string[] = ["Ho capito."];
  if (/interessat|tapparell|vepa|palagina|zanzar|eterya/.test(normalize(raw))) {
    bits.push(raw.slice(0, 120));
  } else {
    bits.push(raw.slice(0, 100));
  }
  if (dateIso) {
    bits.push(`Richiamo ${formatItalianDateSpoken(dateIso)}.`);
  }
  bits.push("Confermi?");
  return bits.join(" ");
}

export function validateJoyVoiceIntent(
  intent: JoyVoiceIntentResult
): { ok: true } | { ok: false; reason: string; spokenReply: string } {
  if (intent.intent === "unknown" || intent.confidence < JOY_GUIDE_CONFIDENCE_MIN) {
    return {
      ok: false,
      reason: "low_confidence",
      spokenReply:
        intent.clarifyQuestion ||
        intent.spokenReply ||
        "Non sono sicuro. Puoi ripetere?",
    };
  }
  if (intent.intent === "clarify") {
    return {
      ok: false,
      reason: "needs_clarification",
      spokenReply: intent.spokenReply,
    };
  }
  const mutating: JoyVoiceIntentType[] = [
    "register_visit",
    "complete_visit",
    "create_follow_up",
    "create_reminder",
    "add_brand",
    "set_brand_status",
  ];
  if (mutating.includes(intent.intent) && !intent.companyId) {
    return {
      ok: false,
      reason: "missing_company",
      spokenReply: "Di quale azienda stiamo parlando?",
    };
  }
  if (
    (intent.intent === "create_follow_up" || intent.intent === "create_reminder") &&
    !intent.entities.followUpDate &&
    !intent.entities.reminderDate
  ) {
    return {
      ok: false,
      reason: "missing_date",
      spokenReply: "Quando? Dimmi una data.",
    };
  }
  return { ok: true };
}
