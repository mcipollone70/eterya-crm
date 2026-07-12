"use client";

import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isValidExcelFile } from "../../utils/parse-excel";

interface FileSelectorProps {
  onFileSelected: (file: File) => void;
  onClear: () => void;
  selectedFileName?: string;
  isLoading: boolean;
  error?: string | null;
}

export function FileSelector({
  onFileSelected,
  onClear,
  selectedFileName,
  isLoading,
  error,
}: FileSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      if (!isValidExcelFile(file)) {
        setLocalError("Formato non supportato. Seleziona un file .xls o .xlsx.");
        return;
      }

      setLocalError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const processFiles = useCallback(
    (files: FileList | null) => {
      processFile(files?.[0]);
    },
    [processFile]
  );

  const displayError = error ?? localError;

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            processFile(e.dataTransfer.files[0]);
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
            isDragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <FileSpreadsheet className="h-7 w-7 text-indigo-600" />
          </div>

          <p className="mt-4 text-sm font-medium text-slate-900">
            Trascina qui il file Excel oppure selezionalo dal dispositivo
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Formati supportati: .xls, .xlsx
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              processFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <Button
            type="button"
            className="mt-6"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Seleziona file Excel
          </Button>

          {selectedFileName && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              <span className="max-w-xs truncate">{selectedFileName}</span>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  onClear();
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Rimuovi file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {displayError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {displayError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
