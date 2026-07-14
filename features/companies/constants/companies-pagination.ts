export const COMPANIES_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type CompaniesPageSize = (typeof COMPANIES_PAGE_SIZE_OPTIONS)[number];

export const COMPANIES_DEFAULT_PAGE_SIZE: CompaniesPageSize = 25;

export const COMPANIES_DEFAULT_PAGE = 1;

export const COMPANIES_PRIORITY_FETCH_BATCH_SIZE = 1000;

export const COMPANIES_PRIORITY_MAX_ROWS = 10000;

export function isCompaniesPageSize(value: number): value is CompaniesPageSize {
  return (COMPANIES_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function parseCompaniesPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return COMPANIES_DEFAULT_PAGE;
  }
  return parsed;
}

export function parseCompaniesPageSize(value: string | undefined): CompaniesPageSize {
  const parsed = Number.parseInt(value ?? "", 10);
  if (isCompaniesPageSize(parsed)) {
    return parsed;
  }
  return COMPANIES_DEFAULT_PAGE_SIZE;
}

export function formatCompaniesVisibleRange(
  page: number,
  pageSize: number,
  total: number
): string {
  if (total <= 0) {
    return "Visualizzate 0 di 0 aziende";
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return `Visualizzate ${start.toLocaleString("it-IT")}–${end.toLocaleString("it-IT")} di ${total.toLocaleString("it-IT")} aziende`;
}

export function getCompaniesTotalPages(total: number, pageSize: number): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

export function clampCompaniesPage(page: number, total: number, pageSize: number): number {
  const totalPages = getCompaniesTotalPages(total, pageSize);
  return Math.min(Math.max(COMPANIES_DEFAULT_PAGE, page), totalPages);
}
