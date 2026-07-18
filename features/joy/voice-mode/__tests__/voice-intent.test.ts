import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCancelUtterance,
  isConfirmUtterance,
  isForbiddenVoiceDeletion,
  intentRequiresConfirmation,
} from "../confirmation-rules";
import { parseItalianRelativeDate } from "../italian-dates";
import { parseJoyVoiceIntent, validateJoyVoiceIntent } from "../parse-voice-intent";
import {
  canTransition,
  shouldSuspendMic,
  tryTransitionJoyGuideState,
} from "../state-machine";
import { buildGoogleMapsDestinationUrl } from "@/features/routes/utils/google-maps-tour-url";

describe("joy voice intent router — 12 mandatory commands", () => {
  const companyCtx = {
    companyId: "co-1",
    companyName: "Trotta",
    nextStopCompanyId: "co-2",
    nextStopName: "Rossi Serramenti",
    nextStopCity: "Latina",
  };

  it("1. Leggimi gli appuntamenti di oggi", () => {
    const r = parseJoyVoiceIntent("Leggimi gli appuntamenti di oggi");
    assert.equal(r.intent, "read_agenda_today");
    assert.equal(r.requiresConfirmation, false);
    assert.ok(r.confidence >= 0.9);
  });

  it("2. Apri il giro di oggi", () => {
    const r = parseJoyVoiceIntent("Apri il giro di oggi");
    assert.equal(r.intent, "open_tour_today");
    assert.equal(r.requiresConfirmation, false);
  });

  it("3. Qual è la prossima tappa?", () => {
    const r = parseJoyVoiceIntent("Qual è la prossima tappa?", companyCtx);
    assert.equal(r.intent, "next_stop");
    assert.equal(r.requiresConfirmation, false);
  });

  it("4. Portami dal prossimo cliente", () => {
    const r = parseJoyVoiceIntent("Portami dal prossimo cliente", companyCtx);
    assert.equal(r.intent, "navigate_next");
    assert.equal(r.requiresConfirmation, false);
  });

  it("5. Cerca Trotta", () => {
    const r = parseJoyVoiceIntent("Cerca Trotta");
    assert.equal(r.intent, "search_company");
    assert.equal(r.entities.companyQuery?.toLowerCase().includes("trotta"), true);
  });

  it("6. Apri la scheda di Trotta", () => {
    const r = parseJoyVoiceIntent("Apri la scheda di Trotta");
    assert.equal(r.intent, "open_company");
    assert.match(r.entities.companyQuery ?? "", /trotta/i);
  });

  it("7. Registra visita (needs company context)", () => {
    const r = parseJoyVoiceIntent("Registra visita", companyCtx);
    assert.equal(r.intent, "register_visit");
    assert.equal(r.requiresConfirmation, true);
    assert.equal(r.companyId, "co-1");
  });

  it("8. Visita completata", () => {
    const r = parseJoyVoiceIntent("Visita completata", companyCtx);
    assert.equal(r.intent, "complete_visit");
    assert.equal(r.requiresConfirmation, true);
  });

  it("9. Richiama tra dieci giorni", () => {
    const now = new Date("2026-07-19T10:00:00");
    const r = parseJoyVoiceIntent("Richiama tra dieci giorni", companyCtx, now);
    assert.equal(r.intent, "create_follow_up");
    assert.equal(r.requiresConfirmation, true);
    assert.ok(r.entities.followUpDate);
  });

  it("10. Ricordami di inviare il preventivo venerdì", () => {
    const now = new Date("2026-07-19T10:00:00"); // Sunday
    const r = parseJoyVoiceIntent(
      "Ricordami di inviare il preventivo venerdì",
      companyCtx,
      now
    );
    assert.equal(r.intent, "create_reminder");
    assert.equal(r.requiresConfirmation, true);
    assert.ok(r.entities.reminderDate);
  });

  it("11. Quali brand ha questa azienda?", () => {
    const r = parseJoyVoiceIntent("Quali brand ha questa azienda?", companyCtx);
    assert.equal(r.intent, "list_brands");
    assert.equal(r.requiresConfirmation, false);
  });

  it("12. Aggiungi Palagina a questa azienda", () => {
    const r = parseJoyVoiceIntent("Aggiungi Palagina a questa azienda", companyCtx);
    assert.equal(r.intent, "add_brand");
    assert.equal(r.requiresConfirmation, true);
    assert.equal(r.entities.brandName, "Palagina");
  });
});

describe("confirmation + cancel", () => {
  it("recognizes confirm/cancel utterances", () => {
    assert.equal(isConfirmUtterance("Confermo"), true);
    assert.equal(isConfirmUtterance("Sì"), true);
    assert.equal(isCancelUtterance("Annulla"), true);
    assert.equal(isCancelUtterance("No"), true);
    assert.equal(isCancelUtterance("Lascia stare"), true);
  });

  it("blocks definitive voice deletions in R2", () => {
    assert.equal(isForbiddenVoiceDeletion("Elimina l'azienda"), true);
    assert.equal(isForbiddenVoiceDeletion("Annulla"), false);
  });

  it("marks mutations as requiring confirmation", () => {
    assert.equal(intentRequiresConfirmation("complete_visit"), true);
    assert.equal(intentRequiresConfirmation("add_brand"), true);
    assert.equal(intentRequiresConfirmation("read_agenda_today"), false);
    assert.equal(intentRequiresConfirmation("navigate_next"), false);
  });
});

describe("italian relative dates", () => {
  const now = new Date("2026-07-19T12:00:00"); // Sunday

  it("parses oggi / domani / tra N giorni / weekday", () => {
    assert.ok(parseItalianRelativeDate("oggi", now));
    assert.ok(parseItalianRelativeDate("domani", now));
    const in10 = parseItalianRelativeDate("tra dieci giorni", now);
    assert.ok(in10);
    const d = new Date(in10!);
    assert.equal(d.getDate(), 29);
    const fri = parseItalianRelativeDate("venerdì", now);
    assert.ok(fri);
    assert.equal(new Date(fri!).getDay(), 5);
  });
});

describe("context + ambiguity", () => {
  it("asks for company when missing", () => {
    const r = parseJoyVoiceIntent("Registra visita");
    assert.equal(r.intent, "clarify");
    assert.match(r.spokenReply, /azienda/i);
  });

  it("uses tour context for next stop", () => {
    const r = parseJoyVoiceIntent("Qual è la prossima tappa?", {
      nextStopName: "Trotta",
      nextStopCompanyId: "x",
    });
    assert.equal(r.intent, "next_stop");
    assert.match(r.spokenReply, /Trotta/);
  });

  it("validate rejects low confidence / unknown", () => {
    const unknown = parseJoyVoiceIntent("xyzqwerty nonsense");
    const v = validateJoyVoiceIntent(unknown);
    assert.equal(v.ok, false);
  });
});

describe("state machine", () => {
  it("allows listening → interpreting → speaking → listening", () => {
    assert.equal(canTransition("listening", "interpreting"), true);
    assert.equal(canTransition("interpreting", "speaking"), true);
    assert.equal(canTransition("speaking", "listening"), true);
    assert.equal(canTransition("idle", "executing"), false);
    assert.equal(tryTransitionJoyGuideState("idle", "executing"), "idle");
  });

  it("suspends mic during TTS / interpreting", () => {
    assert.equal(shouldSuspendMic("speaking"), true);
    assert.equal(shouldSuspendMic("interpreting"), true);
    assert.equal(shouldSuspendMic("listening"), false);
  });
});

describe("google maps nav url for guide mode", () => {
  it("builds HTTPS dest with dir_action=navigate and no origin", () => {
    const url = buildGoogleMapsDestinationUrl({ lat: 41.47, lng: 12.9 });
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\//);
    assert.match(url, /api=1/);
    assert.match(url, /destination=41\.47%2C12\.9|destination=41\.47,12\.9/);
    assert.match(url, /travelmode=driving/);
    assert.match(url, /dir_action=navigate/);
    assert.equal(url.includes("origin="), false);
  });
});
