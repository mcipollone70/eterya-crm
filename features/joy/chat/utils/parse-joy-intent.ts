import type { ProductFamily } from "@/lib/constants/product-catalog";
import { parseJoyStrategyRequest } from "@/features/joy/os/intents/parse-joy-strategy";
import { parseJoySimulationRequest } from "@/features/joy/os/simulations/parse-joy-simulation";

export type JoyIntent =
  | { type: "daily_briefing" }
  | { type: "daily_plan" }
  | { type: "end_of_day_summary" }
  | { type: "weekly_briefing" }
  | { type: "company_timeline"; query: string | null }
  | { type: "visits_today" }
  | { type: "inactive_clients"; days: number }
  | { type: "opportunities_min_amount"; amount: number }
  | { type: "opportunities_summary" }
  | { type: "stale_opportunities" }
  | { type: "product_interest"; family: ProductFamily }
  | { type: "optimize_tour" }
  | { type: "optimize_tour_tomorrow" }
  | { type: "nearby_city"; city: string }
  | { type: "nearby_user" }
  | { type: "open_company"; query: string }
  | { type: "follow_ups" }
  | { type: "follow_ups_overdue" }
  | { type: "agenda_today" }
  | { type: "agenda_tomorrow" }
  | { type: "radar" }
  | { type: "free_time_fill"; freeMinutes: number }
  | { type: "sales_goal"; amount: number; period: "week" | "month" | "year" }
  | {
      type: "prepare_action";
      action: "call" | "visit" | "email";
      query: string | null;
    }
  | { type: "calendar_status" }
  | { type: "pipeline_summary" }
  | { type: "orders_summary" }
  | { type: "quotes_summary" }
  | { type: "product_catalog" }
  | { type: "samples_summary" }
  | { type: "samples_to_recover" }
  | { type: "service_summary" }
  | { type: "open_service_tickets" }
  | { type: "documents_summary" }
  | { type: "contacts_summary" }
  | { type: "prospect_by_city"; city: string | null }
  | { type: "companies_by_city"; city: string }
  | { type: "high_priority" }
  | { type: "missing_email" }
  | { type: "visits_this_week" }
  | { type: "statistics" }
  | { type: "commercial_statistics" }
  | { type: "visit_tours" }
  | { type: "help" }
  | { type: "company_briefing"; query: string | null }
  | { type: "commercial_proposals" }
  | { type: "commercial_coach" }
  | { type: "morning_suggestions" }
  | { type: "agent_learning" }
  | { type: "sell_more_today" }
  | { type: "commercial_radar" }
  | { type: "next_action" }
  | {
      type: "commercial_simulation";
      scenario:
        | "extra_visits"
        | "latina_only"
        | "more_showroom"
        | "follow_all_quotes"
        | "prioritize_vepa";
    }
  | {
      type: "commercial_strategy";
      focus:
        | "revenue"
        | "product_family"
        | "zone"
        | "lost_clients"
        | "sales_goal"
        | "showroom"
        | "pipeline_velocity"
        | "general";
      productFamily?: string | null;
      zone?: string | null;
      amount?: number | null;
      period?: "week" | "month" | "year" | null;
    }
  | { type: "debrief"; raw: string }
  | { type: "plan_tour"; raw: string }
  | { type: "end_conversation" }
  | { type: "detail_expand" }
  | { type: "unknown" };

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function extractAmount(text: string): number | null {
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");
  const match =
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:€|euro|eur)/i) ??
    normalized.match(/(?:sopra|oltre|piu di|più di|minimo)\s*(\d+(?:\.\d+)?)/i) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*k\b/i);

  if (!match) {
    return null;
  }

  let value = Number(match[1]);
  if (/k\b/i.test(match[0])) {
    value *= 1000;
  }
  return Number.isFinite(value) ? value : null;
}

/** Token che non fanno parte del toponimo (evita «Latina che mi tengano…»). */
const CITY_TRAILING_STOP =
  /^(che|mi|me|ci|ti|si|fino|alle|entro|con|per|oggi|domani|tengano|impegnato|impegnati|impegnino|impegnami|impegnano|visite|tappe|prospect|clienti|aziende|ore|minuti|e|o|ma|poi|dopo|prima|verso|presso|nella|nello|nel|dai|dagli|dalle|uno|una|un|il|la|lo|le|i|gli|da|di|in|a|al|alla|ai|agli|alle|su|sul|sulla|max|massimo|giro|tour)$/i;

function cleanCityCapture(raw: string): string | null {
  const parts = raw
    .trim()
    .replace(/[?.!,;:]+$/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    if (CITY_TRAILING_STOP.test(part)) break;
    if (/^\d/.test(part)) break;
    kept.push(part);
    if (kept.length >= 3) break;
  }
  const city = kept.join(" ").trim();
  if (city.length < 2) return null;
  if (
    /^(oggi|domani|prospect|clienti|visite|giro|cap|alle|max|massimo|entrambi|gps|sede|provincia)$/i.test(
      city
    )
  ) {
    return null;
  }
  return city;
}

function isStreetLikeCity(value: string): boolean {
  return /^(via|viale|corso|piazza|piazzale|strada|vicolo|largo|contrada)\b/i.test(
    value.trim()
  );
}

function extractCity(text: string): string | null {
  const patterns = [
    /(?:vicino a|vicini a|intorno a|zona di|clienti a|aziende a|prospect a|prospect di)\s+([a-zàèéìòù\s'-]{2,40})/i,
    // \b su a/di/in: evita che la «a» di «via» catturi «Roma» da «via Roma».
    /(?:mostrami|elenca|lista|dammi|trovami|trova).*(?:aziende|clienti|prospect).*\b(?:a|di|in)\b\s+([a-zàèéìòù\s'-]{2,40})/i,
    /(?:quanti\s+prospect).*\b(?:a|di|in)\b\s+([a-zàèéìòù\s'-]{2,40})/i,
    /\b(?:a|di|in)\b\s+([a-zàèéìòù][a-zàèéìòù'-]{1,30}(?:\s+[a-zàèéìòù][a-zàèéìòù'-]{1,20}){0,2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const city = cleanCityCapture(match[1]);
      if (!city) continue;
      if (isStreetLikeCity(city)) continue;
      if (/^roma$/i.test(city) && /via\s+roma/i.test(text)) continue;
      return city;
    }
  }

  const addressCity = text.match(
    /(?:via|viale|corso|piazza|strada)[^,]*,\s*([a-zàèéìòù][a-zàèéìòù\s'-]{1,30})/i
  );
  if (addressCity?.[1]) {
    const city = cleanCityCapture(addressCity[1]);
    if (city && !isStreetLikeCity(city)) return city;
  }

  return null;
}

/** «Trovami 5 prospect a Latina fino alle 17» → piano giro, non lista generica. */
function isProspectTimeFillRequest(text: string): boolean {
  if (!/prospect/.test(text)) return false;
  const hasCount =
    /\b(?:[1-9]|10|11|12|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/.test(
      text
    ) || /trovami|trova|dammi|elenca|lista|mostrami|proponi/.test(text);
  const hasTimeOrFill =
    /fino\s+alle|entro\s+le|impegnat|impegnino|impegnami|impegnano|tengano|riempi|tempo\s+liber|ore\s+liber/.test(
      text
    );
  return hasCount && hasTimeOrFill;
}

function extractCompanyQuery(text: string): string | null {
  const patterns = [
    /(?:apri|mostra|scheda|briefing|visita)\s+(.+)/i,
    /(?:cliente|azienda)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[?.!]+$/, "");
    }
  }

  return null;
}

function extractFreeMinutes(text: string): number | null {
  if (/mezz.?ora|30\s*min/.test(text)) {
    return 30;
  }
  if (/un['']?\s*ora|\b1\s*ora\b|60\s*min/.test(text)) {
    return 60;
  }
  if (/due\s*ore|\b2\s*ore\b/.test(text)) {
    return 120;
  }
  if (/tre\s*ore|\b3\s*ore\b/.test(text)) {
    return 180;
  }
  if (/quattro\s*ore|\b4\s*ore\b/.test(text)) {
    return 240;
  }

  const hoursMatch = text.match(/(\d+(?:[.,]\d+)?)\s*ore?\b/);
  if (hoursMatch?.[1]) {
    const hours = Number(hoursMatch[1].replace(",", "."));
    if (Number.isFinite(hours) && hours > 0 && hours <= 8) {
      return Math.round(hours * 60);
    }
  }

  const minMatch = text.match(/(\d+)\s*min(?:uti)?\b/);
  if (minMatch?.[1]) {
    const mins = Number(minMatch[1]);
    if (Number.isFinite(mins) && mins >= 15 && mins <= 480) {
      return mins;
    }
  }

  if (/ore\s+liber|tempo\s+liber|slot\s+liber|finestra\s+liber|riempi.*tempo/.test(text)) {
    return 120;
  }

  return null;
}

function extractSalesGoalAmount(text: string): number | null {
  const euroMatch =
    text.match(
      /(?:fatturare|fatturato|obiettivo|target|chiudere|vendere)\s*(?:di\s*)?(?:almeno\s*)?(\d+(?:[.,]\d+)?)\s*(k|mila|mila\s*euro|€|euro|eur)?/i
    ) ??
    text.match(/(\d+(?:[.,]\d+)?)\s*(k|mila)?\s*(?:€|euro|eur)/i);

  if (!euroMatch?.[1]) {
    return extractAmount(text);
  }

  let value = Number(euroMatch[1].replace(",", "."));
  const suffix = (euroMatch[2] ?? "").toLowerCase();
  if (suffix.startsWith("k") || suffix.startsWith("mila")) {
    value *= 1000;
  }
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractSalesGoalPeriod(text: string): "week" | "month" | "year" {
  if (/settiman/.test(text)) return "week";
  if (/ann[oi]|quest'?anno/.test(text)) return "year";
  return "month";
}

function extractInactiveDays(text: string): number {
  if (/un anno|1 anno|12 mesi/.test(text)) {
    return 365;
  }
  if (/sei mesi|6 mesi/.test(text)) {
    return 180;
  }
  if (/tre mesi|3 mesi/.test(text)) {
    return 90;
  }

  const match = text.match(/(\d+)\s*(giorni|mesi|anni)/i);
  if (!match) {
    return 365;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("ann")) {
    return value * 365;
  }
  if (unit.startsWith("mes")) {
    return value * 30;
  }
  return value;
}

export function parseJoyIntent(message: string): JoyIntent {
  const text = normalize(message);

  if (!text) {
    return { type: "help" };
  }

  if (
    /fine\s+(sessione|conversazione)|chiudi\s+(sessione|conversazione)|basta\s+cosi|stop\s+ascolto|esci\s+da\s+conversazione/.test(
      text
    )
  ) {
    return { type: "end_conversation" };
  }

  if (
    /^(joy\s+)?registra\b/.test(text) ||
    /\bdebrief\b/.test(text) ||
    /registra\s+(la\s+)?(visita|nota|esito)/.test(text)
  ) {
    return { type: "debrief", raw: message };
  }

  if (
    (/organizza|pianifica|prepara|costruisci|proponi/.test(text) &&
      /giro|tour|percorso|itinerario/.test(text)) ||
    (/giro|tour/.test(text) &&
      /(?:max|massimo|cap|entro|parto|falegnam|showroom|fabbr|fino a)/.test(text)) ||
    isProspectTimeFillRequest(text) ||
    (/(?:parto|partenza|inizio)(?:\s+da)?/.test(text) &&
      /tempo\s+liber|ore\s+liber|slot\s+liber/.test(text))
  ) {
    return { type: "plan_tour", raw: message };
  }

  if (
    /apprendiment|i miei pattern|come lavoro|le mie abitudini|punti di forza|inefficienz|cosa\s+impari\s+da\s+me|analisi\s+agente/.test(
      text
    )
  ) {
    return { type: "agent_learning" };
  }

  if (
    /chi\s+(?:devo|dovrei)\s+richiam|chi\s+richiamare|da\s+richiamare\s+oggi|chi\s+richiamo/.test(
      text
    )
  ) {
    return { type: "follow_ups_overdue" };
  }

  if (
    /chi\s+(?:devo\s+|dovrei\s+)?chiamare|chi\s+chiamo(?:\s+oggi)?|da\s+chiamare\s+oggi|who\s+to\s+call/.test(
      text
    )
  ) {
    const city = extractCity(message);
    if (city) {
      return { type: "prospect_by_city", city };
    }
    return { type: "follow_ups_overdue" };
  }

  if (
    /chi\s+rischio\s+di\s+perdere|rischio\s+di\s+perdere|clienti?\s+a\s+rischio\s+di\s+perdita|opportunit[aà]\s+a\s+rischio|perso\s+client/.test(
      text
    )
  ) {
    return { type: "stale_opportunities" };
  }

  if (
    /giornata\s+vuota|giorno\s+(?:vuoto|libero)|riempi\s+(?:la\s+)?giornata|non\s+ho\s+niente\s+(?:in\s+)?(?:agenda|programmat)|agenda\s+(?:vuota|libera)|non\s+so\s+cosa\s+fare\s+oggi|riempi\s+(?:il\s+)?giorno/.test(
      text
    )
  ) {
    return { type: "sell_more_today" };
  }

  if (
    /organizza\s+(?:la\s+)?settimana|piano\s+settimanale|settimana\s+commercial|programma\s+(?:la\s+)?settimana/.test(
      text
    )
  ) {
    return { type: "weekly_briefing" };
  }

  if (
    /coach\s+commerciale|direttore\s+vendite|chi\s+(?:devo|dovrei)\s+(?:visitare|chiamare|richiamare)|rischio\s+churn|clienti\s+trascurat|dove\s+investire\s+(?:il\s+)?tempo|priorit[aà]\s+commerciali\s+strategiche/.test(
      text
    )
  ) {
    return { type: "commercial_coach" };
  }

  const freeMinutes = extractFreeMinutes(text);
  if (
    freeMinutes != null &&
    (/ore\s+liber|tempo\s+liber|slot\s+liber|finestra\s+liber|riempi|cosa\s+(?:posso|posso\s+fare)|riempire/.test(
      text
    ) ||
      /ho\s+(?:ancora\s+)?(?:un['']?\s*ora|due\s*ore|tre\s*ore|\d+\s*ore|\d+\s*min)/.test(text) ||
      /due\s*ore\s+liber|un['']?\s*ora\s+liber/.test(text))
  ) {
    return { type: "free_time_fill", freeMinutes };
  }

  if (
    /voglio\s+fatturare|obiettivo\s+(?:di\s+)?(?:fatturato|vendite)|target\s+(?:di\s+)?(?:fatturato|vendite)|fatturare\s+\d/.test(
      text
    )
  ) {
    const amount = extractSalesGoalAmount(text) ?? extractAmount(message);
    if (amount != null && amount > 0) {
      return {
        type: "sales_goal",
        amount,
        period: extractSalesGoalPeriod(text),
      };
    }
  }

  if (
    /prepara\s+(?:una\s+)?(?:chiamata|call)|prepara\s+(?:la\s+)?visita|prepara\s+(?:una\s+)?(?:email|mail)|dammi\s+(?:il\s+)?(?:script|brief)\s+(?:per\s+)?(?:chiamare|visitare)/.test(
      text
    )
  ) {
    const action: "call" | "visit" | "email" = /email|mail/.test(text)
      ? "email"
      : /visita|visitare/.test(text)
        ? "visit"
        : "call";
    const companyMatch =
      message.match(
        /(?:chiamata|call|visita|email|mail|chiamare|visitare)\s+(?:con\s+|per\s+|a\s+|di\s+|presso\s+)?(.+)/i
      ) ?? null;
    const rawQuery = companyMatch?.[1]?.trim().replace(/[?.!]+$/, "") ?? null;
    const query =
      rawQuery &&
      !/^(oggi|domani|cliente|azienda|ora|subito)$/i.test(rawQuery) &&
      rawQuery.length > 1
        ? rawQuery
        : null;
    return { type: "prepare_action", action, query };
  }

  if (
    /cosa\s+mi\s+consigli|suggerimenti\s+(commerciali|mattutini|del\s+mattino)|proposte\s+commerciali|priorit[aà]\s+oggi/.test(
      text
    )
  ) {
    return { type: "commercial_proposals" };
  }

  if (
    /prossima\s+azione|cosa\s+(?:faccio|devo\s+fare)\s+adesso|next\s+action|cosa\s+mi\s+consigli\s+di\s+fare\s+adesso/.test(
      text
    )
  ) {
    return { type: "next_action" };
  }

  if (
    /come\s+vendiamo\s+di\s+piu\s+oggi|vendere\s+di\s+piu\s+oggi|piano\s+vendite\s+oggi|massimizza(?:re)?\s+(?:le\s+)?vendite\s+oggi/.test(
      text
    )
  ) {
    return { type: "sell_more_today" };
  }

  if (
    /radar\s+commercial|radar\s+opportun|slot\s+liber|visita\s+cancellat|chiusura\s+anticipat|preventivi?\s+in\s+scadenz/.test(
      text
    )
  ) {
    return { type: "commercial_radar" };
  }

  {
    const simulation = parseJoySimulationRequest(message);
    if (simulation) {
      return { type: "commercial_simulation", scenario: simulation };
    }
  }

  if (/buongiorno|buon\s+mattino|preparazione\s+mattutina|suggerimenti\s+mattina|inizia\s+la\s+giornata/.test(text)) {
    return { type: "morning_suggestions" };
  }

  if (/^(ciao|salve|help|aiuto|cosa puoi)/.test(text)) {
    return { type: "help" };
  }

  if (/^(dettaglio|dettagli|approfondisci|mostra\s+tutto|versione\s+completa)$/.test(text)) {
    return { type: "detail_expand" };
  }

  if (
    /piano\s+(della\s+)?giornata|tappe\s+(di\s+)?oggi|visite\s+pianificate\s+oggi|mostra.*piano/.test(
      text
    )
  ) {
    return { type: "daily_plan" };
  }

  if (/prepara.*(la mia|la)?\s*giornata|organizza.*(la mia|la)?\s*giornata/.test(text)) {
    return { type: "daily_briefing" };
  }

  if (/riepiloga.*(la mia|la)?\s*giornata|fine giornata|chiusura giornata|com[e']?\s*è\s*andata/.test(text)) {
    return { type: "end_of_day_summary" };
  }

  if (/timeline|cronologia\s+commercial|storico\s+commercial|eventi\s+commercial/.test(text)) {
    const companyMatch =
      message.match(
        /(?:timeline|cronologia|storico)\s+(?:dell['']azienda\s+|del\s+cliente\s+|di\s+|per\s+)?(.+)/i
      ) ?? null;
    const rawQuery = companyMatch?.[1]?.trim().replace(/[?.!]+$/, "") ?? null;
    const query =
      rawQuery &&
      !/^(azienda|cliente|commerciale|oggi|giornata)$/i.test(rawQuery) &&
      rawQuery.length > 1
        ? rawQuery
        : null;
    return { type: "company_timeline", query };
  }

  if (/briefing settimanale|riepilogo settimanale|settimana commerciale/.test(text)) {
    return { type: "weekly_briefing" };
  }

  if (
    /briefing\s+(?:azienda|cliente)|scheda\s+commerciale|riassumi\s+(?:l[''])?azienda|prepara\s+(?:il\s+)?briefing/.test(
      text
    )
  ) {
    const companyMatch =
      message.match(
        /(?:briefing|riassumi|scheda commerciale)\s+(?:dell['']azienda\s+|del\s+cliente\s+|di\s+|per\s+)?(.+)/i
      ) ?? null;
    const rawQuery = companyMatch?.[1]?.trim().replace(/[?.!]+$/, "") ?? null;
    const query =
      rawQuery &&
      !/^(azienda|cliente|commerciale|oggi|giornata)$/i.test(rawQuery) &&
      rawQuery.length > 1
        ? rawQuery
        : null;
    return { type: "company_briefing", query };
  }

  if (/chi devo visitare|visite oggi|visitare oggi|devo andare oggi/.test(text)) {
    return { type: "visits_today" };
  }

  if (/agenda|appuntament/.test(text) && /domani/.test(text)) {
    return { type: "agenda_tomorrow" };
  }

  if (/agenda|appuntament/.test(text) && /oggi/.test(text)) {
    return { type: "agenda_today" };
  }

  if (/statistic.*commercial|kpi commercial|andamento commercial/.test(text)) {
    return { type: "commercial_statistics" };
  }

  if (/statistic|riepilog|sommario|quanto ho fatto|performance/.test(text)) {
    return { type: "statistics" };
  }

  if (/visite/.test(text) && /(settimana|questa settimana)/.test(text)) {
    return { type: "visits_this_week" };
  }

  if (/priorit[aà].*alta|alta priorit|clienti priorit/.test(text)) {
    return { type: "high_priority" };
  }

  if (/senza email|non hanno email|mancano email|email mancante/.test(text)) {
    return { type: "missing_email" };
  }

  if (/quanti\s+prospect|numero\s+prospect|conteggio\s+prospect/.test(text)) {
    const city = extractCity(message);
    return { type: "prospect_by_city", city };
  }

  // «prospect a Latina», «trovami prospect», «elenca prospect» — city opzionale
  if (/\bprospect\b/.test(text)) {
    return { type: "prospect_by_city", city: extractCity(message) };
  }

  if (/(mostrami|elenca|lista|dammi).*(aziende|clienti)/.test(text)) {
    const city = extractCity(message);
    if (city) {
      return { type: "companies_by_city", city };
    }
  }

  if (/dove mi trovo|mia posizione|vicino a me|intorno a me|clienti vicini/.test(text)) {
    return { type: "nearby_user" };
  }

  if (/follow.?up|richiami|richiamare/.test(text) && /(scadut|in ritardo|overdue)/.test(text)) {
    return { type: "follow_ups_overdue" };
  }

  if (/follow.?up|richiami|promemoria|richiamare|da\s+richiamare/.test(text)) {
    return { type: "follow_ups" };
  }

  if (/opportunit/.test(text) && /(ferm|blocc|stagn|senza aggiorn)/.test(text)) {
    return { type: "stale_opportunities" };
  }

  if (/opportunit/.test(text) && /(sopra|oltre|€|euro|valore)/.test(text)) {
    return {
      type: "opportunities_min_amount",
      amount: extractAmount(message) ?? 10_000,
    };
  }

  if (/opportunit/.test(text)) {
    return { type: "opportunities_summary" };
  }

  if (/non vedo|inattiv|non visitat|mai visitat|da quanto/.test(text)) {
    return { type: "inactive_clients", days: extractInactiveDays(text) };
  }

  if (/pipeline/.test(text)) {
    return { type: "pipeline_summary" };
  }

  if (/\bpreventiv/.test(text)) {
    return { type: "quotes_summary" };
  }

  if (/\bordini\b|\bordine\b/.test(text)) {
    return { type: "orders_summary" };
  }

  if (/(catalogo|prodotti)/.test(text) && /(mostra|vedi|quanti|elenco|famigl)/.test(text)) {
    return { type: "product_catalog" };
  }

  if (/campion/.test(text) && /(recuper|scadut|rientro|prestito|da\s+riprendere)/.test(text)) {
    return { type: "samples_to_recover" };
  }

  if (/campion/.test(text)) {
    return { type: "samples_summary" };
  }

  if (
    /assistenz|ticket/.test(text) &&
    /(apert|aperti|da\s+gestire|in\s+corso|aperti)/.test(text)
  ) {
    return { type: "open_service_tickets" };
  }

  if (/assistenz|ticket|intervent|guast/.test(text)) {
    return { type: "service_summary" };
  }

  if (/document|allegat|file|pdf/.test(text)) {
    return { type: "documents_summary" };
  }

  // Selling a product family → strategy engine (propose who/how), not a CRM filter tip.
  {
    const sellProduct =
      /(?:vend[eo]|spingere|focus|obiettivo).*(?:vepa|zanzarier|tapparell|cristal)/.test(text) ||
      /(?:vepa|zanzarier|tapparell|cristal).*(?:vend[eo]|spingere|oggi|settimana)/.test(text);
    if (sellProduct) {
      const strategy = parseJoyStrategyRequest(message);
      if (strategy) {
        return {
          type: "commercial_strategy",
          focus: strategy.focus,
          productFamily: strategy.productFamily,
          zone: strategy.zone,
          amount: strategy.amount,
          period: strategy.period,
        };
      }
      if (/\bvepa\b/.test(text)) {
        return {
          type: "commercial_strategy",
          focus: "product_family",
          productFamily: "vepa",
          zone: null,
          amount: null,
          period: null,
        };
      }
      if (/zanzarier/.test(text)) {
        return {
          type: "commercial_strategy",
          focus: "product_family",
          productFamily: "zanzariere",
          zone: null,
          amount: null,
          period: null,
        };
      }
      if (/tapparell/.test(text)) {
        return {
          type: "commercial_strategy",
          focus: "product_family",
          productFamily: "tapparelle",
          zone: null,
          amount: null,
          period: null,
        };
      }
    }
  }

  if (/\bvepa\b/.test(text)) {
    return { type: "product_interest", family: "vepa" };
  }

  if (/zanzarier/.test(text)) {
    return { type: "product_interest", family: "zanzariere" };
  }

  if (/tapparelle|tapparella/.test(text)) {
    return { type: "product_interest", family: "tapparelle" };
  }

  if (/organizza.*giro|giro migliore|ottimizza.*giro|(pianifica|prepara).*giro.*visite/.test(text)) {
    if (/domani/.test(text)) {
      return { type: "optimize_tour_tomorrow" };
    }
    return { type: "optimize_tour" };
  }

  if (
    /mostrami.*(giro|giri).*(visite|tour)|lista.*giro.*visite|giri visite salvati|quali giro visite/.test(
      text
    )
  ) {
    return { type: "visit_tours" };
  }

  if (/radar/.test(text) && !/ore\s+liber|tempo\s+liber/.test(text)) {
    return { type: "commercial_radar" };
  }

  // Strategist (after concrete CRM intents, before open_company / unknown)
  {
    const strategy = parseJoyStrategyRequest(message);
    if (strategy) {
      if (
        /oggi/.test(text) &&
        (strategy.focus === "revenue" || strategy.focus === "general")
      ) {
        return { type: "sell_more_today" };
      }
      return {
        type: "commercial_strategy",
        focus: strategy.focus,
        productFamily: strategy.productFamily,
        zone: strategy.zone,
        amount: strategy.amount,
        period: strategy.period,
      };
    }
  }

  if (/google calendar|calendario/.test(text)) {
    return { type: "calendar_status" };
  }

  if (/contatt/.test(text) && !/richiam/.test(text)) {
    return { type: "contacts_summary" };
  }

  if (/vicino a|vicini a|intorno a|zona di|clienti a\s|aziende a\s/.test(text)) {
    const city = extractCity(message);
    if (city) {
      return { type: "nearby_city", city };
    }
  }

  const companyQuery = extractCompanyQuery(message);
  if (companyQuery) {
    return { type: "open_company", query: companyQuery };
  }

  return { type: "unknown" };
}
