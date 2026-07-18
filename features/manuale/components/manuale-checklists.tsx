"use client";

import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CHECKLIST_STORAGE_KEY, MANUAL_CHECKLISTS } from "../content/checklists";
import { cn } from "@/utils/cn";

type ChecklistState = Record<string, boolean[]>;

function loadChecklistState(): ChecklistState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ChecklistState;
  } catch {
    return {};
  }
}

function saveChecklistState(state: ChecklistState): void {
  window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

interface ManualeChecklistsProps {
  highlighted?: boolean;
}

export function ManualeChecklists({ highlighted = false }: ManualeChecklistsProps) {
  const [state, setState] = useState<ChecklistState>(loadChecklistState);

  const toggleItem = useCallback((groupId: string, index: number) => {
    setState((prev) => {
      const group = MANUAL_CHECKLISTS.find((g) => g.id === groupId);
      if (!group) return prev;

      const current = prev[groupId] ?? group.items.map(() => false);
      const nextItems = [...current];
      nextItems[index] = !nextItems[index];

      const next = { ...prev, [groupId]: nextItems };
      saveChecklistState(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const empty: ChecklistState = {};
    for (const group of MANUAL_CHECKLISTS) {
      empty[group.id] = group.items.map(() => false);
    }
    saveChecklistState(empty);
    setState(empty);
  }, []);

  return (
    <section
      id="checklist-operative"
      aria-labelledby="checklist-operative-title"
      className={cn(
        "scroll-mt-24 rounded-xl transition-colors duration-700",
        highlighted && "ring-2 ring-indigo-400 ring-offset-2"
      )}
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle id="checklist-operative-title" className="text-base sm:text-lg">
              Checklist operative
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Spunta le attività sul campo. Lo stato viene salvato nel browser.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetAll}
            aria-label="Azzera tutte le checklist"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Azzera checklist
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {MANUAL_CHECKLISTS.map((group) => {
            const checked = state[group.id] ?? group.items.map(() => false);

            return (
              <div key={group.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {group.title}
                </h3>
                <ul className="mt-3 space-y-2" role="list">
                  {group.items.map((item, index) => {
                    const inputId = `${group.id}-item-${index}`;
                    const isChecked = checked[index] ?? false;

                    return (
                      <li key={inputId}>
                        <label
                          htmlFor={inputId}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white",
                            "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1"
                          )}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(group.id, index)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span
                            className={cn(
                              "text-sm leading-relaxed text-slate-700",
                              isChecked && "text-slate-400 line-through"
                            )}
                          >
                            {item}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
