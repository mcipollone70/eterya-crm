"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import {
  CONTACTS_DEFAULT_PAGE,
  CONTACTS_PAGE_SIZE_OPTIONS,
  clampContactsPage,
  formatContactsVisibleRange,
  getContactsTotalPages,
  parseContactsPageSize,
  type ContactsPageSize,
} from "../constants/contacts-pagination";

interface ContactsPaginationProps {
  total: number;
  page: number;
  pageSize: ContactsPageSize;
}

function buildContactsQuery(
  searchParams: URLSearchParams,
  updates: { page?: number; pageSize?: ContactsPageSize }
): string {
  const params = new URLSearchParams(searchParams.toString());

  if (updates.pageSize !== undefined) {
    if (updates.pageSize === parseContactsPageSize(undefined)) {
      params.delete("page_size");
    } else {
      params.set("page_size", String(updates.pageSize));
    }
    params.delete("page");
  }

  if (updates.page !== undefined) {
    if (updates.page <= CONTACTS_DEFAULT_PAGE) {
      params.delete("page");
    } else {
      params.set("page", String(updates.page));
    }
  }

  const query = params.toString();
  return query ? `/contacts?${query}` : "/contacts";
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ContactsPagination({ total, page, pageSize }: ContactsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safePage = clampContactsPage(page, total, pageSize);
  const totalPages = getContactsTotalPages(total, pageSize);
  const rangeLabel = formatContactsVisibleRange(safePage, pageSize, total);

  function navigate(nextPage: number) {
    router.push(buildContactsQuery(searchParams, { page: nextPage }));
  }

  function handlePageSizeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextSize = Number.parseInt(event.target.value, 10) as ContactsPageSize;
    router.push(buildContactsQuery(searchParams, { pageSize: nextSize, page: CONTACTS_DEFAULT_PAGE }));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">{rangeLabel}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Righe
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label="Righe per pagina"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 shadow-sm"
          >
            {CONTACTS_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-1">
          <NavButton label="Prima pagina" disabled={safePage <= 1} onClick={() => navigate(1)}>
            <ChevronFirst className="h-4 w-4" />
            <span className="hidden sm:inline">Prima</span>
          </NavButton>
          <NavButton
            label="Pagina precedente"
            disabled={safePage <= 1}
            onClick={() => navigate(safePage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Precedente</span>
          </NavButton>
          <span className="px-2 text-sm text-slate-600">
            {safePage} / {totalPages}
          </span>
          <NavButton
            label="Pagina successiva"
            disabled={safePage >= totalPages}
            onClick={() => navigate(safePage + 1)}
          >
            <span className="hidden sm:inline">Successiva</span>
            <ChevronRight className="h-4 w-4" />
          </NavButton>
          <NavButton
            label="Ultima pagina"
            disabled={safePage >= totalPages}
            onClick={() => navigate(totalPages)}
          >
            <span className="hidden sm:inline">Ultima</span>
            <ChevronLast className="h-4 w-4" />
          </NavButton>
        </div>
      </div>
    </div>
  );
}
