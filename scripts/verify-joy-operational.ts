/**
 * Joy OS operational quality gate (no CRM DB required).
 * Run: npx.cmd tsx scripts/verify-joy-operational.ts
 */

import { parseJoyIntent } from "../features/joy/chat/utils/parse-joy-intent";
import { parseJoyStrategyRequest } from "../features/joy/os/intents/parse-joy-strategy";
import { joyResponseHasHelpdeskRedirect } from "../features/joy/chat/utils/joy-operational-quality";

const INTENT_CASES: Array<[string, string]> = [
  ["Giornata vuota", "sell_more_today"],
  ["Riempi la giornata", "sell_more_today"],
  ["Non ho niente in agenda oggi", "sell_more_today"],
  ["Oggi voglio vendere VEPA", "commercial_strategy"],
  ["Voglio vendere VEPA oggi", "commercial_strategy"],
  ["Ho due ore libere", "free_time_fill"],
  ["Chi devo richiamare?", "follow_ups_overdue"],
  ["Chi rischio di perdere?", "stale_opportunities"],
  ["Organizza la settimana", "weekly_briefing"],
  ["Organizza la mia giornata", "daily_briefing"],
  ["Clienti a rischio churn", "commercial_coach"],
  ["Non ho visite oggi", "visits_today"],
  ["Come vendiamo di più oggi?", "sell_more_today"],
  ["Radar commerciale", "commercial_radar"],
];

const HELPDESK_BAD = [
  "Apri la pagina aziende e filtra i prospect.",
  "Vai nelle visite e scegli manualmente.",
  "Consulta dashboard per le priorità.",
  "Apri calendario e organiza tu.",
  "Filtra le aziende per VEPA.",
];

const HELPDESK_OK = [
  "Ti propongo 4 visite a Latina. Vuoi che proceda?",
  "Da richiamare: Rossi, Bianchi. Conferma per preparare le chiamate.",
  "Proposta giro pronto. Di' conferma (nessun salvataggio automatico).",
];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const failures: string[] = [];

  for (const [phrase, expectedType] of INTENT_CASES) {
    try {
      const intent = parseJoyIntent(phrase);
      assert(
        intent.type === expectedType,
        `Intent "${phrase}" => ${intent.type}, expected ${expectedType}`
      );
      console.log(`PASS intent: "${phrase}" → ${expectedType}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failures.push(msg);
      console.error(`FAIL intent: "${phrase}" — ${msg}`);
    }
  }

  try {
    const badHits = HELPDESK_BAD.filter((t) => joyResponseHasHelpdeskRedirect(t));
    const okHits = HELPDESK_OK.filter((t) => joyResponseHasHelpdeskRedirect(t));
    assert(
      badHits.length === HELPDESK_BAD.length,
      `Expected all bad samples flagged, got ${badHits.length}`
    );
    assert(
      okHits.length === 0,
      `Operational samples must not flag helpdesk, got ${okHits.length}`
    );
    console.log("PASS helpdesk quality gate");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    failures.push(msg);
    console.error(`FAIL helpdesk gate — ${msg}`);
  }

  try {
    const strategy = parseJoyStrategyRequest("Oggi voglio vendere VEPA");
    assert(strategy != null, "strategy should not be null");
    assert(
      strategy!.focus === "product_family",
      `strategy focus expected product_family, got ${strategy!.focus}`
    );
    assert(
      strategy!.productFamily === "vepa",
      `productFamily expected vepa, got ${strategy!.productFamily}`
    );
    console.log("PASS strategy: Oggi voglio vendere VEPA → product_family/vepa");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    failures.push(msg);
    console.error(`FAIL strategy — ${msg}`);
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log(`All ${INTENT_CASES.length + 2} operational checks passed.`);
}

main();
