"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckSquare,
  Loader2,
  MapPin,
  Package,
  Search,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { globalSearchAction } from "@/features/search/actions/global-search-action";
import {
  GLOBAL_SEARCH_CATEGORY_LABELS,
  type GlobalSearchCategory,
  type GlobalSearchResult,
} from "@/features/search/types";
import { cn } from "@/utils/cn";

const CATEGORY_ICONS: Record<GlobalSearchCategory, LucideIcon> = {
  company: Building2,
  contact: Users,
  opportunity: Target,
  visit: MapPin,
  follow_up: CheckSquare,
  reminder: Bell,
  product: Package,
};

const DEBOUNCE_MS = 300;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  const groupedResults = useMemo(() => {
    const buckets = new Map<GlobalSearchCategory, GlobalSearchResult[]>();
    for (const result of results) {
      const current = buckets.get(result.category) ?? [];
      current.push(result);
      buckets.set(result.category, current);
    }
    return Array.from(buckets.entries()).map(([category, items]) => ({
      category,
      label: GLOBAL_SEARCH_CATEGORY_LABELS[category],
      items,
    }));
  }, [results]);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const openResult = useCallback(
    (result: GlobalSearchResult) => {
      close();
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      router.push(result.href);
    },
    [close, router]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2;
  const visibleResults = useMemo(
    () => (canSearch ? results : []),
    [canSearch, results]
  );
  const visibleError = canSearch ? error : null;
  const visibleGroupedResults = useMemo(
    () => (canSearch ? groupedResults : []),
    [canSearch, groupedResults]
  );

  useEffect(() => {
    if (!open || !canSearch) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const response = await globalSearchAction(trimmedQuery);
        if (response.error) {
          setError(response.error);
          setResults([]);
          setSelectedIndex(0);
          return;
        }

        setError(null);
        const flat = response.groups.flatMap((group) => group.results);
        setResults(flat);
        setSelectedIndex(0);
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [canSearch, open, trimmedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (visibleResults.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % visibleResults.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = visibleResults[selectedIndex];
        if (selected) {
          openResult(selected);
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open, openResult, selectedIndex, visibleResults]);

  useEffect(() => {
    if (!listRef.current || visibleResults.length === 0) {
      return;
    }
    const active = listRef.current.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, visibleResults.length]);

  if (!open) {
    return null;
  }

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={close}
        aria-label="Chiudi ricerca"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ricerca globale"
        className="absolute inset-0 flex flex-col bg-white sm:inset-x-4 sm:top-[10vh] sm:bottom-auto sm:left-1/2 sm:max-h-[min(76vh,640px)] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca aziende, contatti, opportunità, visite..."
            className="min-h-11 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : null}
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2 sm:px-3">
          {!canSearch ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              Digita almeno 2 caratteri per cercare in tutto il CRM.
            </p>
          ) : visibleError ? (
            <p className="px-3 py-8 text-center text-sm text-rose-700">{visibleError}</p>
          ) : !isPending && visibleResults.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              Nessun risultato per &quot;{trimmedQuery}&quot;.
            </p>
          ) : (
            visibleGroupedResults.map((group) => (
              <div key={group.category} className="mb-2">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((result) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const Icon = CATEGORY_ICONS[result.category];
                    const isSelected = index === selectedIndex;

                    return (
                      <li key={`${result.category}-${result.id}`}>
                        <button
                          type="button"
                          data-result-index={index}
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={() => openResult(result)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors sm:py-2.5",
                            isSelected ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium text-slate-900">{result.title}</span>
                              <Badge variant={result.statusVariant}>{result.statusLabel}</Badge>
                            </span>
                            {result.subtitle ? (
                              <span className="mt-0.5 block truncate text-sm text-slate-500">
                                {result.subtitle}
                              </span>
                            ) : null}
                          </span>
                          <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 sm:inline-flex">
                            {result.quickActionLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="hidden border-t border-slate-200 px-4 py-2 text-xs text-slate-500 sm:flex sm:items-center sm:justify-between">
          <span>↑↓ per navigare · Invio per aprire · Esc per chiudere</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-600">
            Ctrl K
          </span>
        </div>
      </div>
    </div>
  );
}

interface SearchTriggerProps {
  onClick: () => void;
  compact?: boolean;
  className?: string;
}

export function SearchTrigger({ onClick, compact = false, className }: SearchTriggerProps) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          className
        )}
        aria-label="Cerca nel CRM"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 hover:bg-white hover:text-slate-700",
        className
      )}
      aria-label="Apri ricerca globale"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">Cerca nel CRM...</span>
      <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 lg:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
