"use client";

import { useCallback, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { MANUAL_FAQ } from "../content/faq";
import { cn } from "@/utils/cn";

interface ManualeFaqProps {
  highlighted?: boolean;
}

export function ManualeFaq({ highlighted = false }: ManualeFaqProps) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <section
      id="domande-frequenti"
      aria-labelledby="domande-frequenti-title"
      className={cn(
        "scroll-mt-24 rounded-xl transition-colors duration-700",
        highlighted && "ring-2 ring-indigo-400 ring-offset-2"
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle id="domande-frequenti-title" className="text-base sm:text-lg">
            Domande frequenti
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Risposte rapide alle domande più comuni sull&apos;utilizzo del CRM.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {MANUAL_FAQ.map((item, index) => {
            const isOpen = openId === item.id;
            const buttonId = `${baseId}-faq-${index}-button`;
            const panelId = `${baseId}-faq-${index}-panel`;

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-900",
                      "transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    )}
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="border-t border-slate-100 px-4 py-3"
                >
                  <p className="text-sm leading-relaxed text-slate-600">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
