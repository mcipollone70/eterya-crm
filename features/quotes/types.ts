import type { ProductFamily } from "@/lib/constants/product-catalog";
import type { CommercialLineInput } from "@/lib/constants/commercial-lines";
import type { OpportunityStatus } from "@/lib/supabase/types";

export interface SaveQuoteInput {
  companyId: string;
  contactId?: string | null;
  title: string;
  productFamily: ProductFamily;
  productIds?: string[];
  lines?: CommercialLineInput[];
  totalAmount?: number;
  validUntil?: string | null;
  notes?: string | null;
  number?: string | null;
  nextAction?: string | null;
  opportunityId?: string | null;
}

export interface UpdateQuoteInput extends SaveQuoteInput {
  status?: OpportunityStatus;
}
