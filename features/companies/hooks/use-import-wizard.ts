"use client";

import { useCallback, useState } from "react";
import type {
  CleaningReport,
  ColumnMapping,
  CompanyImportBrandOptions,
  CompanyImportRecord,
  ImportFileAnalysis,
  ImportPreviewStats,
  ImportWizardStep,
} from "../types/import";
import { parseExcelFile, createInitialMappings } from "../utils/parse-excel";
import { buildAndCleanRecords, hasRequiredMapping } from "../utils/build-records";
import { computePreviewStats } from "../utils/compute-stats";
import { geocodeImportRecordsAction } from "../actions/geocode-import";
import { estimateExistingMatchesAction } from "../actions/import-companies";
import { getDefaultImportBrandOptions } from "../components/import/import-options-panel";

const GEOCODE_CHUNK_SIZE = 50;

interface WizardState {
  currentStep: ImportWizardStep;
  brandOptions: CompanyImportBrandOptions;
  analysis: ImportFileAnalysis | null;
  columnMappings: ColumnMapping[];
  cleanedRecords: CompanyImportRecord[];
  cleaningReport: CleaningReport | null;
  previewStats: ImportPreviewStats | null;
  isLoading: boolean;
  error: string | null;
}

function createInitialState(
  brandOptions?: CompanyImportBrandOptions
): WizardState {
  return {
    currentStep: 1,
    brandOptions: brandOptions ?? getDefaultImportBrandOptions(),
    analysis: null,
    columnMappings: [],
    cleanedRecords: [],
    cleaningReport: null,
    previewStats: null,
    isLoading: false,
    error: null,
  };
}

export function useImportWizard() {
  const [state, setState] = useState<WizardState>(createInitialState);

  const setBrandOptions = useCallback((brandOptions: CompanyImportBrandOptions) => {
    setState((prev) => ({ ...prev, brandOptions, error: null }));
  }, []);

  const analyzeFile = useCallback(async (file: File) => {
    setState((prev) => ({
      ...createInitialState(prev.brandOptions),
      isLoading: true,
    }));

    try {
      const analysis = await parseExcelFile(file);
      const columnMappings = createInitialMappings(analysis);

      setState((prev) => ({
        ...createInitialState(prev.brandOptions),
        analysis,
        columnMappings,
      }));
    } catch (err) {
      setState((prev) => ({
        ...createInitialState(prev.brandOptions),
        error: err instanceof Error ? err.message : "Errore durante l'analisi del file.",
      }));
    }
  }, []);

  const clearFile = useCallback(() => {
    setState((prev) => createInitialState(prev.brandOptions));
  }, []);

  const updateMapping = useCallback(
    (columnIndex: number, mappedField: ColumnMapping["mappedField"]) => {
      setState((prev) => ({
        ...prev,
        columnMappings: prev.columnMappings.map((mapping) =>
          mapping.columnIndex === columnIndex
            ? { ...mapping, mappedField, confidence: "manual" as const }
            : mapping
        ),
      }));
    },
    []
  );

  const goToStep = useCallback((step: ImportWizardStep) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep <= 1) return prev;
      return {
        ...prev,
        currentStep: (prev.currentStep - 1) as ImportWizardStep,
        error: null,
      };
    });
  }, []);

  const goNext = useCallback(async () => {
    const snapshot = state;

    if (snapshot.currentStep === 1) {
      if (!snapshot.brandOptions.brandId.trim()) {
        setState((prev) => ({
          ...prev,
          error: "Seleziona un Brand obbligatorio prima di continuare.",
        }));
        return;
      }
      if (!snapshot.analysis) {
        setState((prev) => ({
          ...prev,
          error: "Seleziona un file Excel per continuare.",
        }));
        return;
      }
      setState((prev) => ({ ...prev, currentStep: 2, error: null }));
      return;
    }

    if (snapshot.currentStep === 2) {
      if (!snapshot.analysis || !hasRequiredMapping(snapshot.columnMappings)) {
        setState((prev) => ({
          ...prev,
          error: "Mappa almeno la colonna Ragione sociale per continuare.",
        }));
        return;
      }
      const { records, report } = buildAndCleanRecords(
        snapshot.analysis,
        snapshot.columnMappings
      );
      setState((prev) => ({
        ...prev,
        cleanedRecords: records,
        cleaningReport: report,
        currentStep: 3,
        error: null,
      }));
      return;
    }

    if (snapshot.currentStep === 3) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const geocodedRecords: CompanyImportRecord[] = [];
      let geocodeMessage: string | null = null;

      for (let index = 0; index < snapshot.cleanedRecords.length; index += GEOCODE_CHUNK_SIZE) {
        const chunk = snapshot.cleanedRecords.slice(index, index + GEOCODE_CHUNK_SIZE);
        const chunkResult = await geocodeImportRecordsAction(chunk);
        geocodedRecords.push(...chunkResult.records);
        if (chunkResult.message) {
          geocodeMessage = chunkResult.message;
        }
      }

      setState((prev) => ({
        ...prev,
        cleanedRecords: geocodedRecords,
        currentStep: 4,
        isLoading: false,
        error: geocodeMessage?.includes("non configurata") ? geocodeMessage : null,
      }));
      return;
    }

    if (snapshot.currentStep === 4) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const previewStats = computePreviewStats(snapshot.cleanedRecords);
      const estimate = await estimateExistingMatchesAction(
        snapshot.cleanedRecords.map((r) => ({
          vatNumber: r.vatNumber,
          email: r.email,
        }))
      );
      setState((prev) => ({
        ...prev,
        previewStats: {
          ...previewStats,
          possibleExistingMatches: estimate.count,
        },
        currentStep: 5,
        isLoading: false,
        error: estimate.error,
      }));
      return;
    }

    if (snapshot.currentStep === 5) {
      if (!snapshot.brandOptions.brandId.trim()) {
        setState((prev) => ({
          ...prev,
          error: "Brand obbligatorio per procedere all'import.",
        }));
        return;
      }
      setState((prev) => ({ ...prev, currentStep: 6, error: null }));
    }
  }, [state]);

  const canGoNext = (() => {
    if (state.isLoading) return false;

    switch (state.currentStep) {
      case 1:
        return (
          state.brandOptions.brandId.trim().length > 0 && state.analysis !== null
        );
      case 2:
        return hasRequiredMapping(state.columnMappings);
      case 3:
        return state.cleanedRecords.length > 0;
      case 4:
        return state.cleanedRecords.length > 0;
      case 5:
        return (
          state.previewStats !== null &&
          state.brandOptions.brandId.trim().length > 0
        );
      case 6:
        return false;
      default:
        return false;
    }
  })();

  return {
    ...state,
    setBrandOptions,
    analyzeFile,
    clearFile,
    updateMapping,
    goNext,
    goBack,
    goToStep,
    canGoNext,
  };
}
