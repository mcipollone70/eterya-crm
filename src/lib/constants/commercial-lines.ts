/** Shared commercial document line-item helpers (preventivi / ordini). */

export interface CommercialLineInput {
  /** Surrogate line id (opportunity_products.id); optional on create. */
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatRate?: number;
  description?: string | null;
  sortOrder?: number;
}

export interface CommercialLineItem extends CommercialLineInput {
  productName?: string | null;
  lineTotal: number;
}

export function calcLineTotal(input: {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatRate?: number;
}): number {
  const qty = Number.isFinite(input.quantity) ? Math.max(0, input.quantity) : 0;
  const price = Number.isFinite(input.unitPrice) ? Math.max(0, input.unitPrice) : 0;
  const discount = clampPercent(input.discountPercent ?? 0);
  const vat = clampPercent(input.vatRate ?? 22);
  const net = qty * price * (1 - discount / 100);
  return Math.round(net * (1 + vat / 100) * 100) / 100;
}

export function calcDocumentTotal(lines: CommercialLineInput[]): number {
  return Math.round(lines.reduce((sum, line) => sum + calcLineTotal(line), 0) * 100) / 100;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function normalizeLineInputs(
  lines: CommercialLineInput[] | undefined,
  fallbackProductIds?: string[]
): CommercialLineInput[] {
  if (lines && lines.length > 0) {
    return lines
      .filter((line) => line.productId)
      .map((line, index) => ({
        id: line.id,
        productId: line.productId,
        quantity: line.quantity > 0 ? line.quantity : 1,
        unitPrice: line.unitPrice >= 0 ? line.unitPrice : 0,
        discountPercent: clampPercent(line.discountPercent ?? 0),
        vatRate: clampPercent(line.vatRate ?? 22),
        description: line.description?.trim() || null,
        sortOrder: line.sortOrder ?? index,
      }));
  }

  if (fallbackProductIds && fallbackProductIds.length > 0) {
    return fallbackProductIds.map((productId, index) => ({
      productId,
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      vatRate: 22,
      description: null,
      sortOrder: index,
    }));
  }

  return [];
}
