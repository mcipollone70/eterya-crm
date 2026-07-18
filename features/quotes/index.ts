/** Quotes module — preventivi commerciali. */
export const QUOTES_MODULE = "quotes" as const;

export { QuotesPage } from "./quotes-page";
export {
  listQuotes,
  getQuoteById,
  saveQuote,
  updateQuote,
  sendQuote,
  duplicateQuote,
  convertQuoteToOrder,
  getQuotesDashboardMetrics,
  listQuoteFilterOptions,
  type QuoteListItem,
  type QuotesDashboardMetrics,
} from "./services/quotes.service";
export type { SaveQuoteInput, UpdateQuoteInput } from "./types";
