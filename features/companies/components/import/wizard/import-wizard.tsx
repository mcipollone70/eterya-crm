"use client";

import { FileSelector } from "../file-selector";
import { WizardStepper } from "./wizard-stepper";
import { WizardNavigation } from "./wizard-navigation";
import { StepAnalysis } from "./step-analysis";
import { StepMapping } from "./step-mapping";
import { StepCleaning } from "./step-cleaning";
import { StepGeocoding } from "./step-geocoding";
import { StepPreview } from "./step-preview";
import { StepImport } from "./step-import";
import { useImportWizard } from "../../../hooks/use-import-wizard";

export function ImportWizard() {
  const wizard = useImportWizard();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Importa Aziende</h2>
        <p className="mt-1 text-sm text-slate-500">
          Wizard di importazione Excel — analisi, mapping, pulizia e preview
          prima dell&apos;importazione nel database.
        </p>
      </div>

      <WizardStepper currentStep={wizard.currentStep} />

      {wizard.error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {wizard.error}
        </div>
      )}

      {wizard.currentStep === 1 && (
        <div className="space-y-6">
          <FileSelector
            onFileSelected={wizard.analyzeFile}
            onClear={wizard.clearFile}
            selectedFileName={wizard.analysis?.fileName}
            isLoading={wizard.isLoading}
          />
          {wizard.analysis && <StepAnalysis analysis={wizard.analysis} />}
        </div>
      )}

      {wizard.currentStep === 2 && wizard.analysis && (
        <StepMapping
          mappings={wizard.columnMappings}
          onMappingChange={wizard.updateMapping}
        />
      )}

      {wizard.currentStep === 3 && wizard.cleaningReport && (
        <StepCleaning
          report={wizard.cleaningReport}
          records={wizard.cleanedRecords}
        />
      )}

      {wizard.currentStep === 4 && (
        <StepGeocoding records={wizard.cleanedRecords} />
      )}

      {wizard.currentStep === 5 && wizard.previewStats && (
        <StepPreview
          stats={wizard.previewStats}
          records={wizard.cleanedRecords}
        />
      )}

      {wizard.currentStep === 6 && (
        <StepImport
          analysis={wizard.analysis}
          records={wizard.cleanedRecords}
          stats={wizard.previewStats}
        />
      )}

      <WizardNavigation
        currentStep={wizard.currentStep}
        canGoNext={wizard.canGoNext}
        isLoading={wizard.isLoading}
        onBack={wizard.goBack}
        onNext={wizard.goNext}
      />
    </div>
  );
}
