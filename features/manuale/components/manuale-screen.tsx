"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { cn } from "@/utils/cn";
import { MANUAL_SECTIONS } from "../content/sections";
import type { ManualMeta, ManualSearchResult } from "../types";
import { buildIndexItems, normalizeText, searchManual } from "../utils/search";
import { ManualeAdminSection } from "./manuale-admin-section";
import { ManualeBackToTop } from "./manuale-back-to-top";
import { ManualeChangelog } from "./manuale-changelog";
import { ManualeChecklists } from "./manuale-checklists";
import { ManualeFaq } from "./manuale-faq";
import { ManualeFooter } from "./manuale-footer";
import { ManualeTourButton } from "./manuale-guided-tour";
import { ManualeSearch } from "./manuale-search";
import { ManualeSection } from "./manuale-section";

interface ManualeScreenProps {
  meta: ManualMeta;
  isAdmin: boolean;
}

function sectionMatchesQuery(sectionId: string, query: string): boolean {
  if (!query) return true;
  const section = MANUAL_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return false;

  const haystack = [
    section.title,
    section.purpose,
    ...(section.steps ?? []),
    ...(section.tips ?? []),
    ...(section.errors?.flatMap((e) => [e.problem, e.solution]) ?? []),
  ].join(" ");

  return normalizeText(haystack).includes(normalizeText(query));
}

export function ManualeScreen({ meta, isAdmin }: ManualeScreenProps) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("checklist-operative");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const indexItems = useMemo(() => buildIndexItems(isAdmin), [isAdmin]);
  const searchResults = useMemo(
    () => searchManual(query, isAdmin),
    [query, isAdmin]
  );

  const filteredIndexItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return indexItems;

    const matchingIds = new Set(searchResults.map((result) => result.id));
    return indexItems.filter((item) => matchingIds.has(item.id));
  }, [indexItems, query, searchResults]);

  const scrollToSection = useCallback((id: string) => {
    const element = sectionRefs.current.get(id) ?? document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setHighlightedId(id);
      window.setTimeout(() => setHighlightedId(null), 1800);
    }
  }, []);

  const handleSelectResult = useCallback(
    (result: ManualSearchResult) => {
      setQuery("");
      scrollToSection(result.id);
    },
    [scrollToSection]
  );

  const registerRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) {
      sectionRefs.current.set(id, node);
    } else {
      sectionRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const ids = filteredIndexItems.map((item) => item.id);
    if (ids.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [filteredIndexItems]);

  const showContent = filteredIndexItems.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Manuale Operativo CRM Eterya"
        subtitle="Guida completa all'utilizzo del sistema"
        compactOnMobile={false}
        actions={<ManualeTourButton autoStart />}
      />

      <ManualeSearch
        query={query}
        onQueryChange={setQuery}
        results={searchResults}
        onSelectResult={handleSelectResult}
      />

      {!showContent ? (
        <div
          className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500"
          role="status"
        >
          Nessun risultato trovato
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <nav
            aria-label="Indice del manuale"
            className="lg:sticky lg:top-20 lg:z-10 lg:w-60 lg:shrink-0 lg:self-start"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Indice
              </p>
              <ul
                className="flex gap-1 overflow-x-auto pb-1 lg:max-h-[calc(100vh-12rem)] lg:flex-col lg:overflow-y-auto lg:pb-0"
                role="list"
              >
                {filteredIndexItems.map((item) => (
                  <li key={item.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      aria-current={activeId === item.id ? "true" : undefined}
                      className={cn(
                        "w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors lg:whitespace-normal",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
                        activeId === item.id
                          ? "border-l-2 border-indigo-600 bg-indigo-50 font-semibold text-indigo-800"
                          : "border-l-2 border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 flex-1 space-y-5 sm:space-y-6">
            {filteredIndexItems.some((item) => item.id === "checklist-operative") && (
              <div ref={(node) => registerRef("checklist-operative", node)}>
                <ManualeChecklists highlighted={highlightedId === "checklist-operative"} />
              </div>
            )}

            {MANUAL_SECTIONS.filter((section) =>
              query.trim() ? sectionMatchesQuery(section.id, query) : true
            ).map((section) => (
              <div key={section.id} ref={(node) => registerRef(section.id, node)}>
                <ManualeSection
                  section={section}
                  highlighted={highlightedId === section.id}
                />
              </div>
            ))}

            {filteredIndexItems.some((item) => item.id === "domande-frequenti") && (
              <div ref={(node) => registerRef("domande-frequenti", node)}>
                <ManualeFaq highlighted={highlightedId === "domande-frequenti"} />
              </div>
            )}

            {filteredIndexItems.some((item) => item.id === "cronologia-aggiornamenti") && (
              <div ref={(node) => registerRef("cronologia-aggiornamenti", node)}>
                <ManualeChangelog highlighted={highlightedId === "cronologia-aggiornamenti"} />
              </div>
            )}

            {isAdmin &&
              filteredIndexItems.some((item) => item.id === "manuale-amministratore") && (
                <div ref={(node) => registerRef("manuale-amministratore", node)}>
                  <ManualeAdminSection
                    highlighted={highlightedId === "manuale-amministratore"}
                  />
                </div>
              )}

            <ManualeFooter meta={meta} />
          </div>
        </div>
      )}

      <ManualeBackToTop />
    </div>
  );
}
