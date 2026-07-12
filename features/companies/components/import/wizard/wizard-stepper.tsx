import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ImportWizardStep } from "../../../types/import";

const STEPS: { step: ImportWizardStep; label: string }[] = [
  { step: 1, label: "Analisi file" },
  { step: 2, label: "Mapping colonne" },
  { step: 3, label: "Pulizia dati" },
  { step: 4, label: "Geocoding" },
  { step: 5, label: "Preview finale" },
  { step: 6, label: "Importazione" },
];

interface WizardStepperProps {
  currentStep: ImportWizardStep;
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <nav aria-label="Progresso importazione" className="w-full">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {STEPS.map(({ step, label }, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <li
              key={step}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isCurrent && "bg-indigo-50 text-indigo-700",
                isCompleted && "text-emerald-600",
                !isCurrent && !isCompleted && "text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  isCurrent && "bg-indigo-600 text-white",
                  isCompleted && "bg-emerald-100 text-emerald-700",
                  !isCurrent && !isCompleted && "bg-slate-100 text-slate-500"
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span className="hidden truncate lg:inline">{label}</span>
              {index < STEPS.length - 1 && (
                <span className="ml-auto hidden h-px flex-1 bg-slate-200 sm:block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
