"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ManualSearchResult } from "../types";
import { cn } from "@/utils/cn";

interface ManualeSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: ManualSearchResult[];
  onSelectResult: (result: ManualSearchResult) => void;
}

export function ManualeSearch({
  query,
  onQueryChange,
  results,
  onSelectResult,
}: ManualeSearchProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const showResults = query.trim().length > 0;

  const handleQueryChange = useCallback(
    (value: string) => {
      setActiveIndex(-1);
      onQueryChange(value);
    },
    [onQueryChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showResults) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        onSelectResult(results[activeIndex]);
        inputRef.current?.blur();
      } else if (event.key === "Escape") {
        onQueryChange("");
        inputRef.current?.blur();
      }
    },
    [activeIndex, onQueryChange, onSelectResult, results, showResults]
  );

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Cerca nel manuale..."
        role="combobox"
        aria-expanded={showResults}
        aria-controls={showResults ? listboxId : undefined}
        aria-autocomplete="list"
        aria-label="Cerca nel manuale"
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      />

      {showResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Risultati ricerca manuale"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500" role="status">
              Nessun risultato trovato
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}-${result.title}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelectResult(result)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-left last:border-b-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  index === activeIndex ? "bg-indigo-50" : "hover:bg-slate-50"
                )}
              >
                <span className="text-sm font-medium text-slate-900">{result.title}</span>
                <span className="text-xs text-slate-500">{result.excerpt}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
