export const CONTACTS_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type ContactsPageSize = (typeof CONTACTS_PAGE_SIZE_OPTIONS)[number];

export const CONTACTS_DEFAULT_PAGE_SIZE: ContactsPageSize = 25;

export const CONTACTS_DEFAULT_PAGE = 1;

export const CONTACTS_FETCH_BATCH_SIZE = 1000;

export function isContactsPageSize(value: number): value is ContactsPageSize {
  return (CONTACTS_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function parseContactsPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return CONTACTS_DEFAULT_PAGE;
  }
  return parsed;
}

export function parseContactsPageSize(value: string | undefined): ContactsPageSize {
  const parsed = Number.parseInt(value ?? "", 10);
  if (isContactsPageSize(parsed)) {
    return parsed;
  }
  return CONTACTS_DEFAULT_PAGE_SIZE;
}

export function formatContactsVisibleRange(
  page: number,
  pageSize: number,
  total: number
): string {
  if (total <= 0) {
    return "Visualizzati 0 di 0 contatti";
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return `Visualizzati ${start.toLocaleString("it-IT")}–${end.toLocaleString("it-IT")} di ${total.toLocaleString("it-IT")} contatti`;
}

export function getContactsTotalPages(total: number, pageSize: number): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

export function clampContactsPage(page: number, total: number, pageSize: number): number {
  const totalPages = getContactsTotalPages(total, pageSize);
  return Math.min(Math.max(CONTACTS_DEFAULT_PAGE, page), totalPages);
}
