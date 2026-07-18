import type { ProductFamily } from "@/lib/constants/product-catalog";
import type { CommercialLineInput } from "@/lib/constants/commercial-lines";
import type { OrderFulfillmentStatus } from "@/lib/supabase/types";

export interface SaveOrderInput {
  companyId: string;
  contactId?: string | null;
  title: string;
  productFamily: ProductFamily;
  productIds?: string[];
  lines?: CommercialLineInput[];
  totalAmount?: number;
  notes?: string | null;
  number?: string | null;
  acceptedAt?: string | null;
  orderStatus?: OrderFulfillmentStatus;
  expectedDeliveryAt?: string | null;
  orderDate?: string | null;
  nextAction?: string | null;
  convertedFromId?: string | null;
}

export type UpdateOrderInput = SaveOrderInput;
