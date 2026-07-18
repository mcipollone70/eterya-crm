"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/cn";

export const TOUR_STORAGE_KEY = "eterya-manuale-tour-completed";
export const TOUR_ACTIVE_KEY = "eterya-manuale-tour-active";
export const TOUR_STEP_KEY = "eterya-manuale-tour-step";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  href: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Centro Operativo",
    description:
      "La home apre il Centro Operativo: badge CRM/Calendar, meteo, «Inizia la giornata» con Joy AI e scorciatoie per giro, agenda e follow-up.",
    target: 'aside a[href="/"]',
    href: "/",
  },
  {
    id: "aziende",
    title: "Aziende",
    description:
      "In Aziende trovi l'elenco completo con filtri commerciali, paginazione e accesso alle schede dettaglio.",
    target: 'aside a[href="/companies"]',
    href: "/companies",
  },
  {
    id: "agenda",
    title: "Agenda",
    description:
      "L'Agenda unifica appuntamenti, visite e follow-up con viste giorno, settimana e mese.",
    target: 'aside a[href="/agenda"]',
    href: "/agenda",
  },
  {
    id: "mappa",
    title: "Mappa",
    description:
      "La Mappa mostra le aziende geocodificate con filtri per provincia, comune e stato commerciale.",
    target: 'aside a[href="/maps"]',
    href: "/maps",
  },
  {
    id: "import",
    title: "Importa aziende",
    description:
      "Importa Aziende consente di caricare elenchi Excel con wizard guidato per mapping, pulizia e geocoding.",
    target: 'aside a[href="/companies/import"]',
    href: "/companies/import",
  },
  {
    id: "manuale",
    title: "Manuale",
    description:
      "Il Manuale operativo riunisce procedure, checklist, FAQ e aggiornamenti. Puoi riavviare questo tour in qualsiasi momento.",
    target: 'aside a[href="/manuale"]',
    href: "/manuale",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(selector?: string): TargetRect | null {
  if (!selector || typeof document === "undefined") return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function startGuidedTour(): void {
  window.sessionStorage.setItem(TOUR_ACTIVE_KEY, "true");
  window.sessionStorage.setItem(TOUR_STEP_KEY, "0");
  window.dispatchEvent(new Event("eterya-tour-change"));
}

export function isTourCompleted(): boolean {
  return window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
}

/** Overlay tour montato nel layout dashboard — persiste tra le navigazioni. */
export function ManualeTourHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(
    () => typeof window !== "undefined" && window.sessionStorage.getItem(TOUR_ACTIVE_KEY) === "true"
  );
  const [stepIndex, setStepIndex] = useState(() =>
    typeof window !== "undefined"
      ? Number(window.sessionStorage.getItem(TOUR_STEP_KEY) ?? "0")
      : 0
  );
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    const onChange = () => {
      setActive(window.sessionStorage.getItem(TOUR_ACTIVE_KEY) === "true");
      setStepIndex(Number(window.sessionStorage.getItem(TOUR_STEP_KEY) ?? "0"));
    };
    window.addEventListener("eterya-tour-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("eterya-tour-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const finishTour = useCallback(() => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    window.sessionStorage.removeItem(TOUR_ACTIVE_KEY);
    window.sessionStorage.removeItem(TOUR_STEP_KEY);
    setActive(false);
    window.dispatchEvent(new Event("eterya-tour-change"));
    router.push("/manuale");
  }, [router]);

  const updateTarget = useCallback(() => {
    setTargetRect(getTargetRect(step?.target));
  }, [step?.target]);

  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.href) {
      router.push(step.href);
    }
    const timer = window.setTimeout(updateTarget, 400);
    window.addEventListener("resize", updateTarget);
    const main = document.querySelector("main");
    main?.addEventListener("scroll", updateTarget, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateTarget);
      main?.removeEventListener("scroll", updateTarget);
    };
  }, [active, step, pathname, router, updateTarget]);

  const goNext = useCallback(() => {
    if (isLast) {
      finishTour();
      return;
    }
    const next = stepIndex + 1;
    window.sessionStorage.setItem(TOUR_STEP_KEY, String(next));
    setStepIndex(next);
    window.dispatchEvent(new Event("eterya-tour-change"));
  }, [finishTour, isLast, stepIndex]);

  const goPrev = useCallback(() => {
    const prev = Math.max(stepIndex - 1, 0);
    window.sessionStorage.setItem(TOUR_STEP_KEY, String(prev));
    setStepIndex(prev);
    window.dispatchEvent(new Event("eterya-tour-change"));
  }, [stepIndex]);

  if (!active || !step) return null;

  const tooltipStyle: React.CSSProperties = targetRect
    ? {
        top: Math.min(targetRect.top + targetRect.height + 12, window.innerHeight - 220),
        left: Math.min(Math.max(targetRect.left, 16), window.innerWidth - 320),
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-slate-900/50" aria-hidden="true" />

      {targetRect && (
        <div
          className="pointer-events-none fixed z-[101] rounded-lg ring-4 ring-indigo-400 ring-offset-2 ring-offset-transparent transition-all duration-300"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manuale-tour-title"
        aria-describedby="manuale-tour-description"
        className={cn(
          "fixed z-[102] w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl",
          !targetRect && "-translate-x-1/2 -translate-y-1/2"
        )}
        style={tooltipStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Tour guidato · {stepIndex + 1}/{TOUR_STEPS.length}
            </p>
            <h2 id="manuale-tour-title" className="mt-1 text-base font-semibold text-slate-900">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={finishTour}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Chiudi tour guidato"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p id="manuale-tour-description" className="text-sm leading-relaxed text-slate-600">
          {step.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={stepIndex === 0}>
            Indietro
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={goNext}>
            {isLast ? "Fine" : "Avanti"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={finishTour} className="ml-auto">
            Salta
          </Button>
        </div>
      </div>
    </>
  );
}

interface ManualeTourButtonProps {
  autoStart?: boolean;
}

/** Pulsante per avviare o riavviare il tour dal Manuale. */
export function ManualeTourButton({ autoStart = false }: ManualeTourButtonProps) {
  const router = useRouter();

  useEffect(() => {
    if (!autoStart || isTourCompleted()) return;
    const timer = window.setTimeout(() => {
      startGuidedTour();
      router.push("/");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [autoStart, router]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        startGuidedTour();
        router.push("/");
      }}
      aria-label="Avvia tour guidato del CRM"
    >
      <Compass className="h-3.5 w-3.5" aria-hidden="true" />
      Avvia tour guidato
    </Button>
  );
}
