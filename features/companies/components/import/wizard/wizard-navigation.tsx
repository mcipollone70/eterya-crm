import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportWizardStep } from "../../../types/import";

interface WizardNavigationProps {
  currentStep: ImportWizardStep;
  canGoNext: boolean;
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function WizardNavigation({
  currentStep,
  canGoNext,
  isLoading,
  onBack,
  onNext,
}: WizardNavigationProps) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-6">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={currentStep === 1 || isLoading}
      >
        <ChevronLeft className="h-4 w-4" />
        Indietro
      </Button>

      {currentStep < 6 && (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Elaborazione...
            </>
          ) : (
            <>
              Avanti
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
